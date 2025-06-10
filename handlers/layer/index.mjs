import { v4 as uuid } from 'uuid';
import { createResponse } from '/opt/nodejs/sample-layer/utils.mjs';

// eslint-disable-next-line no-unused-vars
export const handler = async (event) => {
    return new Promise((resolve) => {
        resolve(createResponse({
            "statusCode": 200,
            "headers": {
                'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
                'Access-Control-Allow-Credentials': true,
            },
            "body": {
                "generatedId": uuid()
            }
        }));
    });
}
