"""Server-side deterministic bargaining. Never send raw engine state to clients."""
from copy import deepcopy
from decimal import Decimal, ROUND_FLOOR, ROUND_CEILING
from datetime import datetime, timezone
from app.negotiation.buyer_agent import BuyerAgent, BuyerContext
from app.negotiation.seller_agent import SellerAgent, SellerContext
from app.negotiation.schemas import Decision

def cents(value, upward=False):
    d=Decimal(str(value))*100
    if not d.is_finite(): raise ValueError("Invalid price")
    return int(d.to_integral_value(rounding=ROUND_CEILING if upward else ROUND_FLOOR))

def now(): return datetime.now(timezone.utc).isoformat()

MODES=("semi_automated","automated")
OPEN_STATUSES=("ready","negotiating")

def requirements(raw):
    q=raw.get("quantity"); rounds=raw.get("maxRounds"); days=raw.get("deliveryDays")
    if type(q) is not int or not 1<=q<=10000: raise ValueError("Quantity must be 1–10000 whole units.")
    if type(rounds) is not int or not 1<=rounds<=12: raise ValueError("Rounds must be 1–12.")
    if type(days) is not int or not 1<=days<=365: raise ValueError("Delivery must be 1–365 days.")
    target=cents(raw.get("targetPrice",0)); maximum=cents(raw.get("maximumPrice",0))
    if not 0<target<=maximum<=100000000: raise ValueError("Check target price and maximum price.")
    if Decimal(str(raw["targetPrice"]))*100!=target or Decimal(str(raw["maximumPrice"]))*100!=maximum: raise ValueError("Use prices with at most two decimal places.")
    mode=raw.get("mode","semi_automated")
    if mode not in MODES: raise ValueError("Mode must be semi_automated or automated.")
    return {"quantity":q,"targetPrice":target/100,"maximumPrice":maximum/100,"deliveryDays":days,"maxRounds":rounds,"mode":mode}

def create(product,buyer_id,raw,listings):
    r=requirements(raw); sellers=[]
    for source in listings:
        s=deepcopy(source); reason="Ready"
        if not s.get("enabled",True): reason="Seller Agent disabled"
        elif s["stock"]<r["quantity"]: reason="Insufficient stock"
        elif not s.get("deliveryDays") or s["deliveryDays"]>r["deliveryDays"]: reason="Delivery unavailable or exceeds deadline"
        excluded=reason!="Ready"
        s.update(status="excluded" if excluded else "ready",reason=reason,history=[],participates=not excluded)
        sellers.append(s)
    if not any(s["participates"] for s in sellers): raise ValueError("No Seller listing meets your quantity and delivery requirements.")
    return {"productId":product["id"],"productName":product["name"],"catalogId":str(listings[0]["catalogId"]),"buyerId":buyer_id,"requirements":r,"round":0,"phase":"running","paused":False,"sellers":sellers,"announcements":[],"createdAt":now(),"updatedAt":now()}

def finish_if_done(e):
    """Move to buyer review once no seller can still change its offer."""
    if e["phase"]!="running": return e
    if any(s["status"]=="awaiting_seller" for s in e["sellers"]): return e
    if e["round"]>=e["requirements"]["maxRounds"] or all(s["status"] not in OPEN_STATUSES for s in e["sellers"]):
        e["phase"]="review";e["stopReason"]="All Seller Agents finished or the round limit was reached."
    return e

def seller_decide(engine,listing_id,seller_id,decision):
    """Semi-automated mode: the seller accepts or rejects the buyer's final offer."""
    e=deepcopy(engine)
    s=next((s for s in e["sellers"] if s["id"]==listing_id and s["sellerId"]==seller_id),None)
    if not s: raise PermissionError("This listing is not part of your negotiations.")
    if e["phase"]!="running" or s["status"]!="awaiting_seller": raise LookupError("No decision is pending for this listing.")
    price=s["pendingOffer"]
    if decision=="accept":
        s["history"].append({"round":e["round"],"agent":"Seller","action":"accept","price":price,"explanation":"The seller accepted the buyer's final offer.","timestamp":now()})
        s.update(status="agreed",currentPrice=price,agreedPrice=price,sellerDecision="accept",reason="The seller accepted the buyer's final offer")
    elif decision=="reject":
        s["history"].append({"round":e["round"],"agent":"Seller","action":"reject","price":price,"explanation":"The seller rejected the buyer's final offer.","timestamp":now()})
        s.update(status="declined",sellerDecision="reject",reason="The seller rejected the buyer's final offer")
    else: raise ValueError("Decision must be accept or reject.")
    s.pop("pendingOffer",None);e["updatedAt"]=now()
    return finish_if_done(e)

def step(engine):
    e=deepcopy(engine)
    if e["phase"]!="running" or e.get("paused"): return e
    if not any(s["participates"] and s["status"] in OPEN_STATUSES for s in e["sellers"]): return finish_if_done(e)
    r=e["requirements"]; e["round"]+=1; n=e["round"]
    prior={s["id"]:s.get("currentPrice") for s in e["sellers"] if s["participates"] and s.get("currentPrice") is not None and s["status"] not in ("declined","excluded")}
    for s in e["sellers"]:
        if not s["participates"] or s["status"] in ("agreed","declined","awaiting_seller"): continue
        limit=min(r["maxRounds"],s.get("maxRounds",r["maxRounds"]))
        if n>limit: s.update(status="declined",reason="Maximum rounds exhausted"); continue
        floor=cents(s["minimumPrice"],True); maximum=cents(r["maximumPrice"])
        # Public context for the language model only; private price limits are never included.
        ctx={"product":s.get("productName") or e["productName"],"round":n,"max_rounds":limit}
        history=s["history"]
        def message(agent,action,price,text): history.append({"round":n,"agent":agent,"action":action,"price":price/100,"explanation":text,"timestamp":now()})
        # The buyer opens at the target price and concedes towards the maximum by the last round.
        buyer_agent = BuyerAgent(BuyerContext(
            opening_price=Decimal(str(r["targetPrice"])),
            target_price=Decimal(str(r["maximumPrice"])),
            maximum_price=Decimal(str(r["maximumPrice"])),
        ))
        buyer = buyer_agent.decide(
            round_number=n,
            max_rounds=limit,
            current_seller_price=Decimal(str(s["currentPrice"])) if s.get("currentPrice") is not None else None,
        )
        if buyer.action == "accept":
            price=cents(buyer.price)
            if floor<=price<=maximum:
                fallback="I accept your current counteroffer for the requested quantity and delivery."
                message("Buyer Agent","accept",price,buyer_agent.respond(buyer,fallback,ctx))
                s.update(status="agreed",agreedPrice=price/100,reason="Both Agents accepted the same price");continue
        offer=cents(buyer.price)
        fallback="Opening target offer." if n==1 else "I can improve my offer within the authorized purchase limits."
        message("Buyer Agent","offer",offer,buyer_agent.respond(buyer,fallback,ctx))
        starting=cents(s["startingPrice"]); concession=max(1,cents(s.get("concession",max(0.01,s["startingPrice"]*.04))))
        competitor=min((cents(p) for key,p in prior.items() if key!=s["id"]),default=None)
        seller_agent=SellerAgent(SellerContext(
            asking_price=Decimal(str(s["startingPrice"])),
            minimum_price=Decimal(str(s["minimumPrice"])),
            concession=Decimal(concession)/100,
        ))
        seller=seller_agent.decide(
            current_buyer_offer=Decimal(offer)/100,
            previous_seller_price=Decimal(str(s["currentPrice"])) if s.get("currentPrice") is not None else None,
            competing_price=Decimal(competitor)/100 if competitor is not None and s.get("strategy","competitive")=="competitive" else None,
            round_number=n,
            max_rounds=limit,
        )
        counter=cents(seller.price)
        explanation="Counteroffer for the requested quantity and delivery."
        if competitor is not None and seller.price < Decimal(starting-concession*(n-1))/100:
            explanation="I improved my counteroffer after receiving an anonymous competing quote."
            history.append({"round":n,"agent":"Market update","action":"announcement","price":competitor/100,"explanation":"Anonymous eligible competing quote; no competitor identity or private limits are shared.","timestamp":now()})
        if seller.action=="accept":
            if not floor<=offer<=maximum: raise ValueError("Agreement boundaries violated")
            fallback="I accept the Buyer Agent offer and the requested quantity and delivery."
            message("Seller Agent","accept",offer,seller_agent.respond(seller,fallback,ctx))
            s.update(currentPrice=offer/100,agreedPrice=offer/100,status="agreed",reason="Both Agents accepted the same price")
        else:
            message("Seller Agent","counteroffer",counter,seller_agent.respond(seller,explanation,{**ctx,"competing_quote":explanation.startswith("I improved")}));s.update(currentPrice=counter/100,status="negotiating",reason="Negotiating")
            if r.get("mode","semi_automated")=="semi_automated" and offer>=maximum and counter>maximum:
                # The buyer reached its last point: hand the decision to the human seller.
                history.append({"round":n,"agent":"System","action":"seller_review","price":offer/100,"explanation":"The buyer reached their final offer. The seller was notified to accept or reject it.","timestamp":now()})
                s.update(status="awaiting_seller",pendingOffer=offer/100,reason="Waiting for the seller to accept or reject the buyer's final offer")
            elif n==limit:
                if counter<=maximum:
                    approved=Decision("accept",Decimal(counter)/100,"Final counteroffer is within the authorized requirements")
                    message("Buyer Agent","accept",counter,buyer_agent.respond(approved,"I accept the final counteroffer within the authorized requirements.",ctx))
                    s.update(agreedPrice=counter/100,status="agreed",reason="Both Agents accepted the same price")
                else:s.update(status="declined",reason="No price within both parties limits before the round limit")
    eligible=[s for s in e["sellers"] if s["participates"] and s.get("currentPrice") is not None]
    if eligible:e["announcements"].append({"round":n,"price":min(s["currentPrice"] for s in eligible),"eligibleCount":len(eligible)})
    e["updatedAt"]=now();return finish_if_done(e)

def buyer_view(engine):
    e=deepcopy(engine)
    allowed={"id","catalogId","name","startingPrice","stock","deliveryDays","participates","status","reason","currentPrice","agreedPrice","pendingOffer","history","productId","productName","description","matchKey","exactProduct"}
    e["sellers"]=[{**{k:v for k,v in s.items() if k in allowed},"exactProduct":s.get("exactProduct",True)} for s in e["sellers"]]
    e["completedRounds"]=e["round"]
    return e
