import importlib.util,unittest,json
from pathlib import Path
spec=importlib.util.spec_from_file_location("engine",Path(__file__).parents[1]/"app/competitive_engine.py");engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
class CompetitiveTests(unittest.TestCase):
 def setUp(self):
  self.r={"quantity":10,"targetPrice":4000,"maximumPrice":4300,"deliveryDays":7,"maxRounds":6,"mode":"automated"}
  self.listings=[{"id":str(i),"catalogId":"exact","name":"Seller "+str(i),"sellerId":i,"startingPrice":price,"minimumPrice":floor,"stock":stock,"deliveryDays":days,"concession":150} for i,price,floor,stock,days in [(1,4700,4050,25,5),(2,4550,3980,18,6),(3,4600,4100,12,9),(4,4250,3900,6,3)]]
 def create(self,r=None):return engine.create({"id":7,"name":"Exact Laptop"},4,r or self.r,self.listings)
 def finish(self,s):
  for _ in range(15):s=engine.step(s)
  return s
 def test_success_and_exclusions(self):
  s=self.finish(self.create());self.assertEqual(s["phase"],"review");self.assertGreaterEqual(sum(x["status"]=="agreed" for x in s["sellers"]),2);self.assertEqual(s["sellers"][2]["status"],"excluded");self.assertEqual(s["sellers"][3]["status"],"excluded")
 def test_no_forced_agreement(self):
  s=self.finish(self.create({**self.r,"targetPrice":400,"maximumPrice":500}));self.assertFalse(any(x["status"]=="agreed" for x in s["sellers"]))
 def test_all_price_boundaries(self):
  for maximum in [1,3999.99,4050,4300,5000]:
   for rounds in [1,2,6,12]:
    r={**self.r,"targetPrice":min(maximum,4000),"maximumPrice":maximum,"maxRounds":rounds};s=self.finish(self.create(r))
    self.assertEqual(s["phase"],"review")
    for seller in s["sellers"]:
     buyer=0;seller_price=float("inf")
     for m in seller["history"]:
      if m["agent"]=="Buyer Agent":self.assertLessEqual(m["price"],maximum)
      if m["agent"]=="Seller Agent":self.assertGreaterEqual(m["price"],seller["minimumPrice"])
      if m["action"]=="offer":self.assertGreaterEqual(m["price"],buyer);buyer=m["price"]
      if m["action"]=="counteroffer":self.assertLessEqual(m["price"],seller_price);seller_price=m["price"]
     if seller["status"]=="agreed":self.assertGreaterEqual(seller["agreedPrice"],seller["minimumPrice"]);self.assertLessEqual(seller["agreedPrice"],maximum)
 def test_anonymous_competition(self):
  s=self.finish(self.create());self.assertTrue(any(m["agent"]=="Market update" for seller in s["sellers"] for m in seller["history"]))
 def test_private_limits_removed(self):
  text=json.dumps(engine.buyer_view(self.finish(self.create())))
  for key in ["minimumPrice","declaredMinimumPrice","maximumDiscount"]:self.assertNotIn(key,text)
 def test_pause_and_terminal(self):
  s=self.create();s["paused"]=True;self.assertEqual(engine.step(s),s)
  for phase in ["cancelled","rejected","approved"]:
   s=self.create();s["phase"]=phase;self.assertEqual(engine.step(s),s)
 def test_invalid_requirements(self):
  for key,value in [("quantity",0),("quantity",1.2),("deliveryDays",0),("maxRounds",13),("targetPrice",5000),("maximumPrice",float("inf")),("targetPrice",4000.001)]:
   with self.assertRaises((ValueError,TypeError,OverflowError)):self.create({**self.r,key:value})
 def test_input_immutable(self):
  s=self.create();before=json.dumps(s,sort_keys=True);engine.step(s);self.assertEqual(json.dumps(s,sort_keys=True),before)
class SemiAutomatedTests(unittest.TestCase):
 """The buyer concedes to its maximum; then the human seller decides (semi-automated mode)."""
 def setUp(self):
  self.r={"quantity":1,"targetPrice":3080,"maximumPrice":3657.5,"deliveryDays":7,"maxRounds":6,"mode":"semi_automated"}
  self.listings=[{"id":"a","catalogId":"x","name":"A","sellerId":1,"startingPrice":3850,"minimumPrice":3500,"stock":5,"deliveryDays":3,"concession":154},
                 {"id":"b","catalogId":"x","name":"B","sellerId":2,"startingPrice":4200,"minimumPrice":3900,"stock":5,"deliveryDays":3,"concession":60}]
 def run_all(self,r=None):
  s=engine.create({"id":1,"name":"Phone"},9,r or self.r,self.listings)
  for _ in range(10):s=engine.step(s)
  return s
 def test_buyer_reaches_maximum_then_waits_for_seller(self):
  s=self.run_all();b=s["sellers"][1]
  self.assertEqual(s["phase"],"running");self.assertEqual(b["status"],"awaiting_seller");self.assertEqual(b["pendingOffer"],3657.5)
  self.assertEqual(s["round"],6)
  self.assertEqual(engine.step(s)["round"],6)
 def test_seller_accept_and_reject(self):
  s=self.run_all()
  accepted=engine.seller_decide(s,"b",2,"accept");self.assertEqual(accepted["phase"],"review");self.assertEqual(accepted["sellers"][1]["agreedPrice"],3657.5)
  rejected=engine.seller_decide(s,"b",2,"reject");self.assertEqual(rejected["sellers"][1]["status"],"declined")
 def test_only_owner_and_only_once(self):
  s=self.run_all()
  with self.assertRaises(PermissionError):engine.seller_decide(s,"b",1,"accept")
  with self.assertRaises(LookupError):engine.seller_decide(engine.seller_decide(s,"b",2,"accept"),"b",2,"accept")
  with self.assertRaises(ValueError):engine.seller_decide(s,"b",2,"maybe")
 def test_automated_declines_instead(self):
  s=self.run_all({**self.r,"mode":"automated"});self.assertEqual(s["phase"],"review");self.assertEqual(s["sellers"][1]["status"],"declined")
 def test_invalid_mode(self):
  with self.assertRaises(ValueError):engine.create({"id":1,"name":"Phone"},9,{**self.r,"mode":"manual"},self.listings)
if __name__=="__main__":unittest.main()
