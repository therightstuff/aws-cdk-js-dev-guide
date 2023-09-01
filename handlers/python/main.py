
import json

from faker import Faker


def handler(event, context):
    fake = Faker()

    return {
        "statusCode": 200,
        "headers": {},
        "body": json.dumps({
            "success": True,
            "name": fake.name(),
            "address": fake.address(),
            "password": fake.password()
        })}
