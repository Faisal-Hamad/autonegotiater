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

def requirements(raw):
    q=raw.get("quantity"); rounds=raw.get("maxRounds"); days=raw.get("deliveryDays")
    if type(q) is not int or not 1<=q<=10000: raise ValueError("Quantity must be 1–10000 whole units.")
    if type(rounds) is not int or not 1<=rounds<=12: raise ValueError("Rounds must be 1–12.")
    if type(days) is not int or not 1<=days<=365: raise ValueError("Delivery must be 1–365 days.")
    target=cents(raw.get("targetPrice",0)); maximum=cents(raw.get("maximumPrice",0))
    if not 0<target<=maximum<=100000000: raise ValueError("Check target price and maximum price.")
    if Decimal(str(raw["targetPrice"]))*100!=target or Decimal(str(raw["maximumPrice"]))*100!=maximum: raise ValueError("Use prices with at most two decimal places.")
    return {"quantity":q,"targetPrice":target/100,"maximumPrice":maximum/100,"deliveryDays":days,"maxRounds":rounds}

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

def step(engine):
    e=deepcopy(engine)
    if e["phase"]!="running" or e.get("paused"): return e
    r=e["requirements"]; e["round"]+=1; n=e["round"]
    prior={s["id"]:s.get("currentPrice") for s in e["sellers"] if s["participates"] and s.get("currentPrice") is not None and s["status"] not in ("declined","excluded")}
    for s in e["sellers"]:
        if not s["participates"] or s["status"] in ("agreed","declined"): continue
        limit=min(r["maxRounds"],s.get("maxRounds",r["maxRounds"]))
        if n>limit: s.update(status="declined",reason="Maximum rounds exhausted"); continue
        floor=cents(s["minimumPrice"],True); maximum=cents(r["maximumPrice"])
        history=s["history"]
        def message(agent,action,price,text): history.append({"round":n,"agent":agent,"action":action,"price":price/100,"explanation":text,"timestamp":now()})
        buyer_agent = BuyerAgent(BuyerContext(
            target_price=Decimal(str(r["targetPrice"])),
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
                message("Buyer Agent","accept",price,buyer_agent.respond(buyer,fallback))
                s.update(status="agreed",agreedPrice=price/100,reason="Both Agents accepted the same price");continue
        offer=cents(buyer.price)
        fallback="Opening target offer." if n==1 else "I can improve my offer within the authorized purchase limits."
        message("Buyer Agent","offer",offer,buyer_agent.respond(buyer,fallback))
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
            message("Seller Agent","accept",offer,seller_agent.respond(seller,fallback))
            s.update(currentPrice=offer/100,agreedPrice=offer/100,status="agreed",reason="Both Agents accepted the same price")
        else:
            message("Seller Agent","counteroffer",counter,seller_agent.respond(seller,explanation));s.update(currentPrice=counter/100,status="negotiating",reason="Negotiating")
            if n==limit:
                if counter<=maximum:
                    approved=Decision("accept",Decimal(counter)/100,"Final counteroffer is within the authorized requirements")
                    message("Buyer Agent","accept",counter,buyer_agent.respond(approved,"I accept the final counteroffer within the authorized requirements."))
                    s.update(agreedPrice=counter/100,status="agreed",reason="Both Agents accepted the same price")
                else:s.update(status="declined",reason="No price within both parties limits before the round limit")
    eligible=[s for s in e["sellers"] if s["participates"] and s.get("currentPrice") is not None]
    if eligible:e["announcements"].append({"round":n,"price":min(s["currentPrice"] for s in eligible),"eligibleCount":len(eligible)})
    if n>=r["maxRounds"] or all(s["status"] in ("agreed","declined","excluded") for s in e["sellers"]):
        e["phase"]="review";e["stopReason"]="All Seller Agents finished or the round limit was reached."
    e["updatedAt"]=now();return e

def buyer_view(engine):
    e=deepcopy(engine)
    allowed={"id","catalogId","name","startingPrice","stock","deliveryDays","participates","status","reason","currentPrice","agreedPrice","history","productId","productName","description","matchKey","exactProduct"}
    e["sellers"]=[{**{k:v for k,v in s.items() if k in allowed},"exactProduct":s.get("exactProduct",True)} for s in e["sellers"]]
    e["completedRounds"]=e["round"]
    return e
