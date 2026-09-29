from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ProductPublic(BaseModel):
    """What buyers see. Must never include min_acceptable_price (NFR-03)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    seller_id: int
    name: str
    description: str | None
    category: str
    base_price: Decimal
    stock_quantity: int
    image_url: str | None
    created_at: datetime
