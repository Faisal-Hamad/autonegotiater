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

MODES=("nil","semi_automated","automated")
OPEN_STATUSES=("ready","negotiating")

def ar_fallback(action, agent, price=None, round_num=1, competing=False):
    p_str = f"{price:,.2f} ر.س" if price is not None else ""
    if agent in ("Buyer Agent", "Buyer"):
        if action == "accept":
            return f"أوافق على العرض المقابل بسعر {p_str} للكمية وشروط التوصيل المطلوبة."
        if round_num == 1:
            return f"عرض افتتاحي بسعر مستهدف {p_str} للكمية وشروط التوصيل المحددة."
        return f"يمكنني رفع عرضي إلى {p_str} ضمن حدود الشراء المعتمدة."
    if agent in ("Seller Agent", "Seller"):
        if action == "accept":
            return f"أوافق على عرض المشتري بسعر {p_str} مع الالتزام بالكمية ومدة التوصيل."
        if action == "reject" or action == "decline":
            return "تم رفض العرض لعدم توافقه مع الحدود السعرية المعتمدة للبائع."
        if competing:
            return f"تم تحسين العرض المقابل إلى {p_str} للمنافسة مع عروض السوق الأخرى."
        return f"عرض مقابل بسعر {p_str} للكمية وشروط التوصيل المطلوبة."
    if agent == "Market update":
        return f"عرض تنافسي مؤهل في السوق بسعر {p_str} (هوية البائع وحدوده السرية محجوبة)."
    return "تحديث من النظام حول حالة التفاوض."

def requirements(raw):
    q=raw.get("quantity"); rounds=raw.get("maxRounds"); days=raw.get("deliveryDays")
    if type(q) is not int or not 1<=q<=10000: raise ValueError("Quantity must be 1–10000 whole units.")
    if type(rounds) is not int or not 1<=rounds<=12: raise ValueError("Rounds must be 1–12.")
    if type(days) is not int or not 1<=days<=365: raise ValueError("Delivery must be 1–365 days.")
    target=cents(raw.get("targetPrice",0)); maximum=cents(raw.get("maximumPrice",0))
    if not 0<target<=maximum<=100000000: raise ValueError("Check target price and maximum price.")
    if Decimal(str(raw["targetPrice"]))*100!=target or Decimal(str(raw["maximumPrice"]))*100!=maximum: raise ValueError("Use prices with at most two decimal places.")
    mode=raw.get("mode","semi_automated")
    if mode not in MODES: raise ValueError("Mode must be nil, semi_automated or automated.")
    return {"quantity":q,"targetPrice":target/100,"maximumPrice":maximum/100,"deliveryDays":days,"maxRounds":rounds,"mode":mode}

def create(product,buyer_id,raw,listings):
    r=requirements(raw); sellers=[]
    for source in listings:
        s=deepcopy(source); reason="Ready"
        s_mode = s.get("sellerMode", "semi_automated")
        if s_mode not in MODES: s_mode = "semi_automated"
        s["sellerMode"] = s_mode
        if not s.get("enabled",True) and s_mode != "nil": reason="Seller Agent disabled"
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

def seller_decide(engine,listing_id,seller_id,decision,counter_price=None,note=None):
    """Semi-automated or Nil mode: the seller accepts, rejects, or sends a manual counteroffer."""
    e=deepcopy(engine)
    s=next((s for s in e["sellers"] if s["id"]==listing_id and s["sellerId"]==seller_id),None)
    if not s: raise PermissionError("This listing is not part of your negotiations.")
    if e["phase"]!="running" or s["status"] not in ("awaiting_seller","ready","negotiating"):
        raise LookupError("No decision is pending for this listing.")
    price=s.get("pendingOffer") or (s["history"][-1].get("price") if s["history"] else s["startingPrice"])
    if decision=="accept":
        text = note.strip() if note and note.strip() else "The seller accepted the buyer's offer."
        s["history"].append({"round":max(1,e["round"]),"agent":"Seller","action":"accept","price":price,"explanation":text,"explanation_ar":ar_fallback("accept","Seller",price,max(1,e["round"])),"timestamp":now()})
        s.update(status="agreed",currentPrice=price,agreedPrice=price,sellerDecision="accept",reason="The seller accepted the buyer's final offer")
        s.pop("pendingOffer",None)
    elif decision=="reject":
        text = note.strip() if note and note.strip() else "The seller rejected the buyer's final offer."
        s["history"].append({"round":max(1,e["round"]),"agent":"Seller","action":"reject","price":price,"explanation":text,"explanation_ar":ar_fallback("reject","Seller",price,max(1,e["round"])),"timestamp":now()})
        s.update(status="declined",sellerDecision="reject",reason="The seller rejected the buyer's final offer")
        s.pop("pendingOffer",None)
    elif decision=="counter" and counter_price is not None:
        c_val = cents(counter_price)/100
        floor = cents(s["minimumPrice"],True)/100
        if c_val < floor:
            raise ValueError("Counteroffer cannot be below your minimum acceptable price.")
        text = note.strip() if note and note.strip() else f"Manual seller counteroffer at {c_val:,.2f} SAR."
        r_num = max(1, e["round"])
        s["history"].append({"round":r_num,"agent":"Seller","action":"counteroffer","price":c_val,"explanation":text,"explanation_ar":ar_fallback("counteroffer","Seller",c_val,r_num),"timestamp":now()})
        s.update(status="negotiating",currentPrice=c_val,reason="Manual counteroffer sent by Seller")
        s.pop("pendingOffer",None)
        if c_val <= e["requirements"]["maximumPrice"] and e["requirements"].get("mode") != "nil":
            s["history"].append({"round":r_num,"agent":"Buyer Agent","action":"accept","price":c_val,"explanation":"I accept your counteroffer within the authorized purchase limits.","explanation_ar":ar_fallback("accept","Buyer Agent",c_val,r_num),"timestamp":now()})
            s.update(status="agreed",agreedPrice=c_val,reason="Both parties accepted the same price")
    else: raise ValueError("Decision must be accept, reject, or counter with a valid price.")
    e["updatedAt"]=now()
    return finish_if_done(e)

def buyer_manual_offer(engine, offer_price, note=None, listing_id=None, action="offer"):
    """Nil (Manual) buyer mode: the human buyer submits a manual offer or accepts a seller's quote."""
    e = deepcopy(engine)
    if e["phase"] != "running":
        raise LookupError("This session is not running.")
    r = e["requirements"]
    p_val = cents(offer_price) / 100
    if p_val <= 0 or p_val > r["maximumPrice"]:
        raise ValueError("Manual offer must be positive and within your maximum budget.")
    if e["round"] < r["maxRounds"]:
        e["round"] += 1
    n = e["round"]
    targets = [s for s in e["sellers"] if s["participates"] and (listing_id is None or s["id"] == listing_id) and s["status"] not in ("agreed", "declined", "excluded")]
    if not targets:
        raise LookupError("No active seller listings available for a manual offer.")
    prior = {s["id"]: s.get("currentPrice") for s in e["sellers"] if s["participates"] and s.get("currentPrice") is not None and s["status"] not in ("declined", "excluded")}
    for s in targets:
        limit = min(r["maxRounds"], s.get("maxRounds", r["maxRounds"]))
        if n > limit:
            s.update(status="declined", reason="Maximum rounds exhausted")
            continue
        floor = cents(s["minimumPrice"], True) / 100
        if action == "accept" and s.get("currentPrice") is not None and s["currentPrice"] <= r["maximumPrice"]:
            agreed_p = s["currentPrice"]
            text = note.strip() if note and note.strip() else "I accept your current offer."
            s["history"].append({"round": n, "agent": "Buyer Agent", "action": "accept", "price": agreed_p, "explanation": text, "explanation_ar": ar_fallback("accept", "Buyer", agreed_p, n), "timestamp": now()})
            s.update(status="agreed", agreedPrice=agreed_p, reason="Buyer manually accepted the seller's offer")
            continue
        text = note.strip() if note and note.strip() else f"Manual buyer offer of {p_val:,.2f} SAR."
        s["history"].append({"round": n, "agent": "Buyer Agent", "action": "offer", "price": p_val, "explanation": text, "explanation_ar": ar_fallback("offer", "Buyer", p_val, n), "timestamp": now()})
        s_mode = s.get("sellerMode", "semi_automated")
        if s_mode == "nil":
            s.update(status="awaiting_seller", pendingOffer=p_val, reason="Waiting for manual response from Seller")
            continue
        starting = cents(s["startingPrice"])
        concession = max(1, cents(s.get("concession", max(0.01, s["startingPrice"] * 0.04))))
        competitor = min((cents(p) for key, p in prior.items() if key != s["id"]), default=None)
        seller_agent = SellerAgent(SellerContext(
            asking_price=Decimal(str(s["startingPrice"])),
            minimum_price=Decimal(str(s["minimumPrice"])),
            concession=Decimal(concession) / 100,
        ))
        seller = seller_agent.decide(
            current_buyer_offer=Decimal(str(p_val)),
            previous_seller_price=Decimal(str(s["currentPrice"])) if s.get("currentPrice") is not None else None,
            competing_price=Decimal(competitor) / 100 if competitor is not None and s.get("strategy", "competitive") == "competitive" else None,
            round_number=n,
            max_rounds=limit,
        )
        ctx = {"product": s.get("productName") or e["productName"], "round": n, "max_rounds": limit}
        if seller.action == "accept" and p_val >= floor:
            if s_mode == "semi_automated":
                s["history"].append({"round": n, "agent": "System", "action": "seller_review", "price": p_val, "explanation": "Buyer offer meets seller terms. Waiting for Seller confirmation.", "explanation_ar": ar_fallback("seller_review", "System", p_val, n), "timestamp": now()})
                s.update(status="awaiting_seller", pendingOffer=p_val, reason="Waiting for the seller to confirm or reject the offer")
            else:
                fb = "I accept the Buyer offer and the requested quantity and delivery."
                s["history"].append({"round": n, "agent": "Seller Agent", "action": "accept", "price": p_val, "explanation": seller_agent.respond(seller, fb, ctx), "explanation_ar": ar_fallback("accept", "Seller Agent", p_val, n), "timestamp": now()})
                s.update(currentPrice=p_val, agreedPrice=p_val, status="agreed", reason="Seller Agent accepted the manual buyer offer")
        else:
            counter = cents(seller.price) / 100
            fb = "Counteroffer for the requested quantity and delivery."
            s["history"].append({"round": n, "agent": "Seller Agent", "action": "counteroffer", "price": counter, "explanation": seller_agent.respond(seller, fb, ctx), "explanation_ar": ar_fallback("counteroffer", "Seller Agent", counter, n), "timestamp": now()})
            s.update(currentPrice=counter, status="negotiating", reason="Negotiating")
            if s_mode == "semi_automated" and p_val >= r["maximumPrice"] and counter > r["maximumPrice"]:
                s["history"].append({"round": n, "agent": "System", "action": "seller_review", "price": p_val, "explanation": "The buyer reached their final offer. The seller was notified to accept or reject it.", "explanation_ar": ar_fallback("seller_review", "System", p_val, n), "timestamp": now()})
                s.update(status="awaiting_seller", pendingOffer=p_val, reason="Waiting for the seller to accept or reject the buyer's final offer")
    e["updatedAt"] = now()
    return finish_if_done(e)

def step(engine):
    e=deepcopy(engine)
    if e["phase"]!="running" or e.get("paused"): return e
    if e["requirements"].get("mode")=="nil": return e
    if not any(s["participates"] and s["status"] in OPEN_STATUSES for s in e["sellers"]): return finish_if_done(e)
    r=e["requirements"]; e["round"]+=1; n=e["round"]
    prior={s["id"]:s.get("currentPrice") for s in e["sellers"] if s["participates"] and s.get("currentPrice") is not None and s["status"] not in ("declined","excluded")}
    for s in e["sellers"]:
        if not s["participates"] or s["status"] in ("agreed","declined","awaiting_seller"): continue
        limit=min(r["maxRounds"],s.get("maxRounds",r["maxRounds"]))
        if n>limit: s.update(status="declined",reason="Maximum rounds exhausted"); continue
        floor=cents(s["minimumPrice"],True); maximum=cents(r["maximumPrice"])
        s_mode = s.get("sellerMode", "semi_automated")
        # Public context for the language model only; private price limits are never included.
        ctx={"product":s.get("productName") or e["productName"],"round":n,"max_rounds":limit}
        history=s["history"]
        def message(agent,action,price,text,comp=False):
            history.append({"round":n,"agent":agent,"action":action,"price":price/100,"explanation":text,"explanation_ar":ar_fallback(action,agent,price/100,n,comp),"timestamp":now()})
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
        if s_mode == "nil":
            history.append({"round":n,"agent":"System","action":"seller_review","price":offer/100,"explanation":"Manual seller mode (Nil): waiting for the Seller to send a counteroffer or accept.","explanation_ar":ar_fallback("seller_review","System",offer/100,n),"timestamp":now()})
            s.update(status="awaiting_seller",pendingOffer=offer/100,reason="Waiting for manual response from Seller")
            continue
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
            history.append({"round":n,"agent":"Market update","action":"announcement","price":competitor/100,"explanation":"Anonymous eligible competing quote; no competitor identity or private limits are shared.","explanation_ar":ar_fallback("announcement","Market update",competitor/100,n,True),"timestamp":now()})
        if seller.action=="accept":
            if not floor<=offer<=maximum: raise ValueError("Agreement boundaries violated")
            fallback="I accept the Buyer Agent offer and the requested quantity and delivery."
            message("Seller Agent","accept",offer,seller_agent.respond(seller,fallback,ctx))
            s.update(currentPrice=offer/100,agreedPrice=offer/100,status="agreed",reason="Both Agents accepted the same price")
        else:
            comp_flag = explanation.startswith("I improved")
            message("Seller Agent","counteroffer",counter,seller_agent.respond(seller,explanation,{**ctx,"competing_quote":comp_flag}),comp_flag);s.update(currentPrice=counter/100,status="negotiating",reason="Negotiating")
            if (r.get("mode","semi_automated")=="semi_automated" or s_mode=="semi_automated") and r.get("mode")!="automated" and offer>=maximum and counter>maximum:
                # The buyer reached its last point: hand the decision to the human seller.
                history.append({"round":n,"agent":"System","action":"seller_review","price":offer/100,"explanation":"The buyer reached their final offer. The seller was notified to accept or reject it.","explanation_ar":ar_fallback("seller_review","System",offer/100,n),"timestamp":now()})
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
    allowed={"id","catalogId","name","startingPrice","stock","deliveryDays","participates","status","reason","currentPrice","agreedPrice","pendingOffer","history","productId","productName","description","matchKey","exactProduct","sellerMode"}
    e["sellers"]=[{**{k:v for k,v in s.items() if k in allowed},"exactProduct":s.get("exactProduct",True)} for s in e["sellers"]]
    e["completedRounds"]=e["round"]
    return e
