import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from 'uuid';
import { createResponse } from '/opt/nodejs/sample-layer/utils.mjs';

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));
const sqs = new SQSClient({});

const QUEUE_URL = process.env.QUEUE_URL;
const TABLE_NAME = process.env.TABLE_NAME;

const TTL_IN_SECONDS = 60;

function getExpirationTime() {
    return Math.floor(Date.now() / 1000) + TTL_IN_SECONDS;
}

let corsHeaders = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
    'Access-Control-Allow-Credentials': true,
};

export const publish = async (event) => {
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

        // create the new message object
        let newId = uuid();
        const command = new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify({
                "objectId": newId,
                "dataOwner": "sqs-publisher",
                "payload": payload,
                "expiration": getExpirationTime()
            })
          });

        // push the message object to the queue
        console.log(`publishing object ${newId}`);
        try {
            await sqs.send(command);
            resolve(createResponse({
                "statusCode": 200,
                "headers": corsHeaders,
                "body": {
                    "success": true,
                    "id": newId
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
        };
    });
}

export const subscribe = async (event) => {
    for (let record of event.Records) {
        const obj = JSON.parse(record.body);
        console.log(`processing object ${obj.objectId}`);

        try {
            // put must be called synchronously or it
            // will be killed as the function ends
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: obj
            });
            console.log(`item ${obj.objectId} stored`);
        } catch (err) {
            console.error(err);
        }
    }
}
