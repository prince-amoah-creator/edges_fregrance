import os

from dotenv import load_dotenv
from sqlalchemy import URL
from sqlalchemy.engine import make_url

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY")

    database_url = os.getenv("DATABASE_URL")

    if database_url:
        SQLALCHEMY_DATABASE_URI = make_url(
            database_url
        ).set(drivername="mysql+pymysql")
    else:
        SQLALCHEMY_DATABASE_URI = URL.create(
            drivername="mysql+pymysql",
            username=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST", "127.0.0.1"),
            port=int(os.getenv("DB_PORT", "3306")),
            database=os.getenv("DB_NAME")
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
