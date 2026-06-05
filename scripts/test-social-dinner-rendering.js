const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

// Standard dynamic template resolver logic from getEmailTemplate
const sanitizeHtml = require('sanitize-html');

function getBranding(conf) {
    return {
        name: conf?.name || 'SCITO',
        email: conf?.email || 'support@scito.org',
        accentColor: conf?.accent_color || '#007aff',
        baseUrl: 'http://localhost:3000',
        logo: conf?.logo_url || '',
        banner: conf?.banner_url || ''
    };
}

function renderHeader(brand) {
    return `<div style="text-align: center; margin-bottom: 20px;">
        ${brand.logo ? `<img src="${brand.logo}" alt="${brand.name}" style="max-height: 60px; margin-bottom: 10px;" />` : ''}
        <h2 style="margin: 0; color: #1e293b;">${brand.name}</h2>
    </div>`;
}

async function test() {
    console.log('🧪 Starting social dinner template rendering verification test...');
    
    let db;
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        // 1. Get first conference to test
        const [confs] = await db.execute('SELECT * FROM conferences LIMIT 1');
        if (confs.length === 0) {
            console.log('⚠️ No conferences found in database to test.');
            return;
        }

        const testConf = confs[0];
        console.log(`📡 Connected. Selected conference: ${testConf.acronym}`);

        // 2. Temporarily update with test values
        const testDate = 'Wednesday, May 27th, at 20:00h';
        const testLoc = '<a href="https://maps.app.goo.gl/bZSYHuqKcTgMFhK96" target="_blank" style="color: #0071e3; text-decoration: underline;">Playachica, Benicàssim</a>';
        
        console.log('✍️ Updating test conference with dinner details...');
        await db.execute(
            'UPDATE conferences SET social_dinner_date = ?, social_dinner_location = ? WHERE id = ?',
            [testDate, testLoc, testConf.id]
        );

        // 3. Query back to verify it was written correctly
        const [updatedConfs] = await db.execute('SELECT * FROM conferences WHERE id = ?', [testConf.id]);
        const updatedConf = updatedConfs[0];
        console.log('✅ Column values stored in DB:');
        console.log(`   social_dinner_date: "${updatedConf.social_dinner_date}"`);
        console.log(`   social_dinner_location: "${updatedConf.social_dinner_location}"`);

        // 4. Test substitution logic
        const brand = getBranding(updatedConf);
        const placeholders = {
            name: 'John Doe',
            qrCodes: [{ token: 'test-token', dietary: 'Vegan' }]
        };

        const richPlaceholders = {
            ...placeholders,
            header: renderHeader(brand),
            conferenceName: brand.name,
            conferenceEmail: brand.email,
            accentColor: brand.accentColor,
            logoUrl: brand.logo,
            bannerUrl: brand.banner,
            conference: brand.name,
            'brand.name': brand.name,
            'brand.email': brand.email,
            'brand.accentColor': brand.accentColor,
            'renderHeader(brand)': renderHeader(brand),
            
            // Social Dinner Placeholders
            social_dinner_date: updatedConf.social_dinner_date || 'TBD',
            social_dinner_location: updatedConf.social_dinner_location || 'TBD',
            'conference.social_dinner_date': updatedConf.social_dinner_date || 'TBD',
            'conference.social_dinner_location': updatedConf.social_dinner_location || 'TBD'
        };

        // Fallback/Default template body simulating what email-templates.js returns
        let defaultBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    \${renderHeader(brand)}
    <h1 style="color: #1d1d1f; font-size: 24px;">Hello \${name},</h1>
    <p>Here are your tickets for the Social Dinner. Please show this QR at the entrance.</p>
    <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        The social dinner will take place on \${social_dinner_date} at \${social_dinner_location}
    </p>
</div>
`.replace('\\${renderHeader(brand)}', renderHeader(brand));

        // Use default body to test placeholder replacement
        let html = defaultBody;

        // Interpolate placeholders
        Object.entries(richPlaceholders).forEach(([k, v]) => {
            let value = v;
            if (k === 'qrCodes' && Array.isArray(v)) {
                value = v.map((qc) => `
                    <div style="margin-bottom: 20px; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
                        <img src="${brand.baseUrl}/api/qr/${qc.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px;" />
                        <p style="margin: 5px 0; font-weight: bold; color: ${brand.accentColor};">Dietary: ${qc.dietary}</p>
                    </div>
                `).join('');
            }
            const re = new RegExp('\\$\\{' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g');
            html = html.replace(re, value);
        });

        // Append QR fallback if not present
        if (!html.includes('api/qr/')) {
             const qrHtml = placeholders.qrCodes.map((qc) => `
                <div style="margin-bottom: 20px; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
                    <img src="${brand.baseUrl}/api/qr/${qc.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px;" />
                    <p style="margin: 5px 0; font-weight: bold; color: ${brand.accentColor};">Dietary: ${qc.dietary}</p>
                </div>
             `).join('');
             if (html.includes('</div>')) {
                 const lastIdx = html.lastIndexOf('</div>');
                 html = html.substring(0, lastIdx) + qrHtml + html.substring(lastIdx);
             } else {
                 html += qrHtml;
             }
        }

        // Sanitize
        html = sanitizeHtml(html, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style']),
            allowedAttributes: {
              a: ['href', 'name', 'target'],
              img: ['src', 'alt', 'style'],
              '*': ['style']
            }
        });

        console.log('\n✉️ Interpolated and Sanitized HTML output:');
        console.log('--------------------------------------------------');
        console.log(html);
        console.log('--------------------------------------------------');

        // Verification checks
        const checkDate = html.includes('on Wednesday, May 27th, at 20:00h');
        const checkLoc = html.includes('href="https://maps.app.goo.gl/bZSYHuqKcTgMFhK96"');
        const checkStyle = html.includes('color:#0071e3');
        const checkTarget = html.includes('target="_blank"');

        if (checkDate && checkLoc && checkStyle && checkTarget) {
            console.log('🎉 SUCCESS: All parameters substituted and HTML structure/attributes fully preserved!');
        } else {
            console.error('❌ FAILURE: Missing substituted parameters or sanitized attributes.');
        }

        // Reset the test conference values back to original
        console.log('\n🧹 Cleaning up test conference values...');
        await db.execute(
            'UPDATE conferences SET social_dinner_date = ?, social_dinner_location = ? WHERE id = ?',
            [testConf.social_dinner_date, testConf.social_dinner_location, testConf.id]
        );
        console.log('✨ Cleanup complete.');

    } catch (e) {
        console.error('❌ Error during testing:', e);
    } finally {
        if (db) await db.end();
        process.exit(0);
    }
}

test();
