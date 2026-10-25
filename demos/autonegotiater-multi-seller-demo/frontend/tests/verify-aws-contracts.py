"""Static schema comparison only; never import or run FastAPI or open a database."""
import ast,json,re,sys
from pathlib import Path
reference=Path(sys.argv[1])
frontend=Path(__file__).resolve().parents[1]
workspace=ast.parse((reference/'backend/app/routers/workspace.py').read_text(encoding='utf-8-sig'))
contracts=(frontend/'lib/api-contracts.ts').read_text(encoding='utf-8')
payload_names={'RegisterPayload':'register','ProfilePayload':'profile','UserStatusPayload':'userStatus','ProductPayload':'product','RulesPayload':'rules','CreateSessionPayload':'session','EndSessionPayload':'end','RatingPayload':'rating'}
for cls in [n for n in workspace.body if isinstance(n,ast.ClassDef) and n.name in payload_names]:
 expected={n.target.id for n in cls.body if isinstance(n,ast.AnnAssign)}
 line=re.search(r'^  '+payload_names[cls.name]+r': \{([^}]+)\}',contracts,re.M).group(1)
 actual=set(re.findall(r'(\w+)\??:',line))
 assert expected==actual,(cls.name,expected,actual)
routes=set()
for n in ast.walk(workspace):
 if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='router' and n.func.attr in {'get','post','put','patch'} and n.args and isinstance(n.args[0],ast.Constant):
  routes.add((n.func.attr.upper(),'/workspace'+n.args[0].value))
actual=set(re.findall(r'method: "(GET|POST|PUT|PATCH)", path: "([^"]+)"',contracts))
assert routes==actual,(routes-actual,actual-routes)
public=ast.parse((reference/'backend/app/schemas/product.py').read_text(encoding='utf-8-sig'))
fields={n.target.id for c in public.body if isinstance(c,ast.ClassDef) and c.name=='ProductPublic' for n in c.body if isinstance(n,ast.AnnAssign)}
api=(frontend/'lib/api.ts').read_text(encoding='utf-8')
product_type=re.search(r'export type Product = \{(.*?)\};',api,re.S).group(1)
assert fields==set(re.findall(r'(\w+):',product_type))
print('PASS: 12 workspace methods/paths, 8 payload field sets and ProductPublic field names match copied AWS Python AST. No app imports, network or DB. Runtime/auth/response behavior NOT_VERIFIED.')
