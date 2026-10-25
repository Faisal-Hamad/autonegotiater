import importlib.util,unittest
from pathlib import Path
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('identity',Path(__file__).parents[1]/'app/product_identity.py');identity=importlib.util.module_from_spec(spec);spec.loader.exec_module(identity)
class IdentityTests(unittest.TestCase):
 def key(self,name,category='Electronics'):return identity.model_storage_key(name,category)
 def test_three_iphone_colors(self):
  self.assertEqual(len({self.key('iPhone 15 Pro 256GB - '+c) for c in ['Natural Titanium','Blue Titanium','Black Titanium']}),1)
 def test_storage_separate(self):self.assertNotEqual(self.key('iPhone 15 Pro 256GB'),self.key('iPhone 15 Pro 128GB'))
 def test_pro_max_separate(self):self.assertNotEqual(self.key('iPhone 15 Pro 256GB'),self.key('iPhone 15 Pro Max 256GB'))
 def test_generation_separate(self):self.assertNotEqual(self.key('iPhone 15 Pro 256GB'),self.key('iPhone 14 Pro 256GB'))
 def test_accessory_not_phone(self):
  for title in ['Case for iPhone 15 Pro 256GB','iPhone 15 Pro 256GB Case','iPhone 15 Pro 256GB Replacement Screen','Fake iPhone 15 Pro 256GB']:
   self.assertIsNone(self.key(title))
 def test_unknown_variant_not_guessed(self):self.assertIsNone(self.key('iPhone 15 Pro 256GB - Special Edition'))
 def test_samsung_storage(self):
  self.assertEqual(self.key('Samsung Galaxy S24 Ultra 256GB Titanium Gray'),self.key('Samsung Galaxy S24 Ultra 256GB - Titanium Black'))
  self.assertNotEqual(self.key('Samsung Galaxy S24 Ultra 256GB'),self.key('Samsung Galaxy S24 Ultra 512GB'))
 def test_samsung_edition(self):self.assertNotEqual(self.key('Samsung Galaxy S24 Ultra 256GB'),self.key('Samsung Galaxy S24 256GB'))
 def test_units_and_case(self):self.assertEqual(self.key('APPLE IPHONE 15 PRO 1TB'),self.key('iPhone 15 Pro 1024GB'))
 def test_non_electronics(self):self.assertIsNone(self.key('iPhone 15 Pro 256GB','Accessories'))
 def test_unstructured_description_not_guessed(self):
  a=SimpleNamespace(id=1,name='Business Laptop',category='Electronics',description='256GB storage');b=SimpleNamespace(id=2,name='Business Laptop',category='Electronics',description='512GB storage')
  self.assertNotEqual(identity.catalog_match_key(a,{1:a,2:b},{}),identity.catalog_match_key(b,{1:a,2:b},{}))
 def test_explicit_catalog_link_preserved(self):
  a=SimpleNamespace(id=1,name='Exact Laptop',category='Electronics',description='Same authorized catalog variant');b=SimpleNamespace(id=2,name='Exact Laptop',category='Electronics',description='Seller public condition details')
  self.assertEqual(identity.catalog_match_key(a,{1:a,2:b},{}),identity.catalog_match_key(b,{1:a,2:b},{2:{'catalogId':'1'}}))
 def test_stale_link_does_not_merge_new_name(self):
  a=SimpleNamespace(id=1,name='Exact Laptop',category='Electronics',description='A');b=SimpleNamespace(id=2,name='Different Laptop',category='Electronics',description='A')
  self.assertNotEqual(identity.catalog_match_key(a,{1:a,2:b},{}),identity.catalog_match_key(b,{1:a,2:b},{2:{'catalogId':'1'}}))
if __name__=='__main__':unittest.main()