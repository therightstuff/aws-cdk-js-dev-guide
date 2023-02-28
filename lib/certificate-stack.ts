import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { WrappedError } from './utils';

export class CertificateStack extends Stack {
    // NOTE: See README.md for instructions on how to configure a Hosted Zone.
    // CAUTION: Hosted Zones are not free, nor is their usage. Each domain you
    //          configure will cost you a minimum of $0.50 per month (assuming
    //          reasonable use)
    //          See https://aws.amazon.com/route53/pricing/ for more details.
    zone: IHostedZone;
    certificate: Certificate;

    constructor(scope: Construct, id: string, props: StackProps, customOptions: any = {}) {
        super(scope, id, props);
        const stack = this;
        const domainName = customOptions.domainName;
        const subdomainNames = customOptions.subdomainNames.map(
            (subdomain: string) => `${subdomain}.${domainName}`
        );

        try {
            this.zone = HostedZone.fromLookup(stack, domainName, {
                domainName,
            });
        } catch (err) {
            throw new WrappedError(`Hosted zone not found for stack ${stack.stackId} in region us-east-1.`, err);
        }

        // TLS certificate, see https://serverfault.com/a/1047117 for domain/subdomain configuration
        this.certificate = new Certificate(
            stack,
            "site-certificate",
            {
                domainName: domainName,
                // this is only necessary if you want to use subdomains
                subjectAlternativeNames: subdomainNames,
                validation: CertificateValidation.fromDns(this.zone)
            }
        );
    }
}
