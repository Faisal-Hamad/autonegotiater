import importlib.util,unittest,json
from pathlib import Path
spec=importlib.util.spec_from_file_location("engine",Path(__file__).parents[1]/"app/competitive_engine.py");engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
class CompetitiveTests(unittest.TestCase):
 def setUp(self):
  self.r={"quantity":10,"targetPrice":4000,"maximumPrice":4300,"deliveryDays":7,"maxRounds":6}
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
if __name__=="__main__":unittest.main()
