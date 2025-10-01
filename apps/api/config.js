require('dotenv').config();

const config = {
    USE_PAYLOAD_CMS: process.env.USE_PAYLOAD_CMS === 'true',
};

module.exports = config;
