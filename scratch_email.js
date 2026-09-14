const { getDefaultEmailBody, emailTemplates } = require('./src/lib/email-templates.js');
const fs = require('fs');

async function main() {
    const html1 = getDefaultEmailBody('certificate', { name: 'TestConf', email_certificate_body: '' });
    fs.writeFileSync('scratch_test_default_body.html', html1);

    const { html: html2 } = emailTemplates.certificate({
        name: 'John Doe',
        conference: { name: 'TestConf', email: 'test@example.com' },
        registrationType: 'Regular',
        token: 'test-token-1234'
    });
    fs.writeFileSync('scratch_test_generated.html', html2);
}

main();
