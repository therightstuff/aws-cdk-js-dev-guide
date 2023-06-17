const fs = require('fs');
const { join } = require('path');

const { Client } = require('pg');

const POSTGRES_HOST = process.env.POSTGRES_HOST;
const POSTGRES_PORT = Number(process.env.POSTGRES_PORT);
const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE;
const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME;
// The password should be stored in a secure location like,
// AWS Secrets Manager or AWS Parameter Store, this is just
// for demo purposes.
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;

// The Lambda functions require SSL certificates to be able to connect securely —
// insecure connections to RDS instances are not allowed.
// See https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html#UsingWithRDS.SSL.CertificatesAllRegions
// for more information
const CA_BUNDLE = fs.readFileSync(join(__dirname, 'global-bundle.pem')).toString();

exports.handler = async (event) => {
    let success = true;
    let message = '';
    try {
        console.log(`Connecting to postgres database ${POSTGRES_DATABASE} on ${POSTGRES_HOST}...`);
        const client = new Client({
            user: POSTGRES_USERNAME,
            host: POSTGRES_HOST,
            database: POSTGRES_DATABASE,
            password: POSTGRES_PASSWORD,
            port: POSTGRES_PORT,
            ssl: {
                rejectUnauthorized: false,
                ca: CA_BUNDLE,
            },
        })

        await client.connect();
        const result = await client.query('SELECT $1::text as message', ['Hello world!']);
        console.log(result.rows[0].message)
        await client.end()
    } catch (error) {
        success = false;
        console.error(`An error occurred:`, error);
        message = `An error occurred: ${error.message}`;
    }

    let result = {
        "isBase64Encoded": false,
        "statusCode": 200,
        "headers": {
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
            'Access-Control-Allow-Credentials': true,
        },
        "body": JSON.stringify({
            "success": success,
            "message": message
        })
    }
    console.log(result);
    return result;
}
