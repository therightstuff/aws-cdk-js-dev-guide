import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from 'uuid';
import { createResponse } from '/opt/nodejs/sample-layer/utils.mjs';

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));

const TABLE_NAME = process.env.TABLE_NAME;
const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

export const handler = async (event) => {
    return new Promise(async (resolve) => {
        let payload = null;
        try {
            payload = JSON.parse(event.body);
        } catch (err) {
            return resolve(createResponse({
                "statusCode": 400,
                "headers": corsHeaders,
                "body": {
                    "success": false,
                    "reason": "unable to parse request body, expected valid JSON format"
                }
            }));
        }

        // add a new object to the table
        let newDataOwner = uuid();
        let newObjectId = uuid();
        try {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    "dataOwner": newDataOwner,
                    "objectId": newObjectId,
                    "payload": payload,
                    "expiration": getExpirationTime()
                }
            });
            resolve(createResponse({
                "statusCode": 200,
                "headers": corsHeaders,
                "body": {
                    "success": true,
                    "dataOwner": newDataOwner,
                    "objectId": newObjectId
                }
            }));
        } catch (err) {
            console.error(err);
            resolve(createResponse({
                "statusCode": 500,
                "headers": corsHeaders,
                "body": {
                    "success": false,
                    "reason": "an unexpected error occurred",
                    "error": err
                }
            }));
        }
    });
}
