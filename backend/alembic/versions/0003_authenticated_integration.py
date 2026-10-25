"""Add authenticated web sessions and durable competitive records; preserve all existing rows."""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op
revision="0003"
down_revision="0002"
branch_labels=None
depends_on=None
def upgrade():
    op.create_table("web_auth_sessions",sa.Column("token_hash",sa.String(64),primary_key=True),sa.Column("user_id",sa.BigInteger(),sa.ForeignKey("users.id",ondelete="CASCADE"),nullable=False),sa.Column("expires_at",sa.DateTime(timezone=True),nullable=False))
    op.create_index("ix_web_auth_sessions_user_id","web_auth_sessions",["user_id"])
    op.create_table("web_integration_records",sa.Column("id",sa.String(100),primary_key=True),sa.Column("kind",sa.String(20),nullable=False),sa.Column("owner_id",sa.BigInteger(),sa.ForeignKey("users.id",ondelete="CASCADE"),nullable=False),sa.Column("data",postgresql.JSONB(),nullable=False))
    op.create_index("ix_web_integration_records_kind_owner","web_integration_records",["kind","owner_id"])
def downgrade():
    # Only new integration tables; never remove original business tables.
    op.drop_table("web_integration_records")
    op.drop_table("web_auth_sessions")
