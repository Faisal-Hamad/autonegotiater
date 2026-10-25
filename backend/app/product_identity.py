"""Conservative model/storage identities. Never use partial-name similarity or rewrite catalog IDs."""
import hashlib,re,unicodedata

def normalized(value):
    value=unicodedata.normalize("NFKC",value or "").casefold()
    value=re.sub(r"[\u2010-\u2015_|()/-]+"," ",value)
    return " ".join(value.split())

COLORS={"natural titanium","blue titanium","black titanium","white titanium","desert titanium","titanium gray","titanium grey","titanium black","titanium violet","titanium yellow","space black","space gray","space grey","deep purple","rose gold","midnight","starlight","graphite","natural","black","white","blue","green","purple","pink","red","yellow","orange","silver","gold","gray","grey"}
CONDITIONS={"new","used","refurbished","like new","open box","excellent condition","good condition"}
def model_storage_key(name,category):
    if normalized(category)!="electronics":return None
    title=normalized(name)
    patterns=[("apple",r"(?:apple )?iphone (\d{1,2})(?: (pro max|pro|plus|mini))? (\d+)\s*(gb|tb)(?: (.*))?"),
              ("samsung",r"(?:samsung )?galaxy (s\d{2}|a\d{2})(?: (ultra|plus|fe))? (\d+)\s*(gb|tb)(?: (.*))?")]
    for brand,pattern in patterns:
        m=re.fullmatch(pattern,title)
        if not m:continue
        model,edition,capacity,unit,tail=m.groups()
        if tail and tail not in COLORS and tail not in CONDITIONS and not any(tail==color+" "+condition or tail==condition+" "+color for color in COLORS for condition in CONDITIONS):return None
        gb=int(capacity)*(1024 if unit=="tb" else 1)
        if gb not in {64,128,256,512,1024,2048}:return None
        return ":".join(("model-v1",brand,model,edition or "standard",str(gb)+"gb"))
    return None

def exact_identity(product):
    known=model_storage_key(product.name,product.category)
    if known:return known
    data="\x1f".join(normalized(v) for v in (product.category,product.name,product.description))
    return "exact-v1:"+hashlib.sha256(data.encode()).hexdigest()

def catalog_match_key(product,products,metadata):
    own=exact_identity(product)
    if own.startswith("model-v1:"):return own
    link=metadata.get(product.id,{}).get("catalogId")
    try:source=products.get(int(link)) if link is not None else None
    except (ValueError,TypeError):source=None
    if source and normalized(source.name)==normalized(product.name) and normalized(source.category)==normalized(product.category):return exact_identity(source)
    return own
