#!/bin/bash

# Directory where phpMyAdmin will be stored
PMA_DIR="phpmyadmin"
PMA_VERSION="5.2.1"
PMA_URL="https://files.phpmyadmin.net/phpMyAdmin/${PMA_VERSION}/phpMyAdmin-${PMA_VERSION}-all-languages.zip"

cd "$(dirname "$0")"/..

if [ ! -d "$PMA_DIR" ]; then
    echo "📥 Downloading phpMyAdmin version ${PMA_VERSION}..."
    curl -o phpmyadmin.zip $PMA_URL
    
    echo "📦 Extracting..."
    unzip -q phpmyadmin.zip
    mv phpMyAdmin-${PMA_VERSION}-all-languages $PMA_DIR
    rm phpmyadmin.zip
    
    # Create basic config file
    cp $PMA_DIR/config.sample.inc.php $PMA_DIR/config.inc.php
    
    # Generate a random blowfish secret for cookie auth
    SECRET=$(openssl rand -base64 32 | tr -d '\n\r/+=' | cut -c1-32)
    sed -i '' "s/\$cfg\['blowfish_secret'\] = '';/\$cfg\['blowfish_secret'\] = '${SECRET}';/" $PMA_DIR/config.inc.php
    
    # Change host from localhost to 127.0.0.1 to force TCP connection (prevents socket errors on Mac)
    sed -i '' "s/'localhost'/'127.0.0.1'/" $PMA_DIR/config.inc.php
    
    # Allow login with empty password for local development
    echo "\$cfg['Servers'][\$i]['AllowNoPassword'] = true;" >> $PMA_DIR/config.inc.php
    
    echo "✅ phpMyAdmin downloaded and configured successfully!"
fi

echo ""
echo "=========================================================="
echo "🚀 Starting phpMyAdmin Server..."
echo "👉 Open your browser to: http://127.0.0.1:8080"
echo "🔑 Login with your Database credentials:"
echo "   Username: root"
echo "   Password: [leave empty]"
echo "Press Ctrl+C to stop the server."
echo "=========================================================="
echo ""

cd $PMA_DIR
php -S 127.0.0.1:8080
