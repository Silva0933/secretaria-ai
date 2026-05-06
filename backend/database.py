from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


def doc(d):
    """Convert MongoDB document to JSON-serializable dict."""
    if d is None:
        return None
    result = {}
    from bson import ObjectId
    for k, v in d.items():
        if k == '_id':
            result['id'] = str(v)
        elif isinstance(v, ObjectId):
            result[k] = str(v)
        else:
            result[k] = v
    return result


def docs(lst):
    return [doc(d) for d in lst if d]
