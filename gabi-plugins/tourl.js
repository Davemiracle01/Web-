const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { react01 } = require('../lib/extra');

// Multiple upload services for redundancy
async function uploadImage(buffer) {
    const services = [
        uploadToImgbb,    // Primary - supports various formats
        uploadToFreeImage, // Secondary
    ];

    for (const service of services) {
        try {
            const url = await service(buffer);
            if (url) return url;
        } catch (error) {
            console.log(`Service ${service.name} failed:`, error.message);
            continue;
        }
    }
    throw new Error('All image upload services failed');
}

async function uploadFile(buffer, filename = 'file') {
    const services = [
        uploadToAnonymousFiles,  // Primary
        uploadToFileIo,          // Secondary
        uploadToUguu             // Tertiary
    ];

    for (const service of services) {
        try {
            const url = await service(buffer, filename);
            if (url) return url;
        } catch (error) {
            console.log(`Service ${service.name} failed:`, error.message);
            continue;
        }
    }
    throw new Error('All file upload services failed');
}

// Image upload services
async function uploadToImgbb(buffer) {
    const form = new FormData();
    form.append('image', buffer.toString('base64'));
    
    const response = await axios.post('https://api.imgbb.com/1/upload?key=ea093d65ee3a064667d7fb096fc15038', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    
    if (response.data && response.data.data && response.data.data.url) {
        return response.data.data.url;
    }
    throw new Error('ImgBB upload failed');
}

async function uploadToFreeImage(buffer) {
    const form = new FormData();
    form.append('source', buffer, { filename: 'image.jpg' });
    
    const response = await axios.post('https://freeimage.host/api/1/upload', form, {
        params: {
            key: '6d207e02198a847aa98d0a2a901485a5' // Free public key
        },
        headers: form.getHeaders(),
        timeout: 30000
    });
    
    if (response.data && response.data.image && response.data.image.url) {
        return response.data.image.url;
    }
    throw new Error('FreeImage upload failed');
}

async function uploadToImgur(buffer) {
    // Requires IMGUR_CLIENT_ID in environment variables
    const clientId = process.env.IMGUR_CLIENT_ID;
    if (!clientId) throw new Error('Imgur client ID not configured');
    
    const form = new FormData();
    form.append('image', buffer);
    
    const response = await axios.post('https://api.imgur.com/3/image', form, {
        headers: {
            'Authorization': `Client-ID ${clientId}`,
            ...form.getHeaders()
        },
        timeout: 30000
    });
    
    if (response.data && response.data.data && response.data.data.link) {
        return response.data.data.link;
    }
    throw new Error('Imgur upload failed');
}

// File upload services
async function uploadToAnonymousFiles(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, { filename });
    
    const response = await axios.post('https://api.anonymousfiles.io/', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    
    if (response.data && response.data.url) {
        return response.data.url;
    }
    throw new Error('AnonymousFiles upload failed');
}

async function uploadToFileIo(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, { filename });
    
    const response = await axios.post('https://file.io', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    
    if (response.data && response.data.success && response.data.link) {
        return response.data.link;
    }
    throw new Error('File.io upload failed');
}

async function uploadToUguu(buffer, filename) {
    const form = new FormData();
    form.append('files[]', buffer, { filename });
    
    const response = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    
    if (response.data && response.data.files && response.data.files[0] && response.data.files[0].url) {
        return response.data.files[0].url;
    }
    throw new Error('Uguu upload failed');
}

// Fallback to direct WhatsApp media URL (for videos/files)
async function getDirectMediaUrl(message, messageType) {
    try {
        const mediaContent = message.message[messageType];
        if (mediaContent && mediaContent.url) {
            return mediaContent.url;
        }
        return null;
    } catch (error) {
        return null;
    }
}

module.exports = {
    command: ['tourl', 'upload', 'url'],
    description: 'Upload media to URL',

    run: async ({ sock, msg, from, sender, isOwner, isSudo, settings }) => {   
        try {
            await react01(sock, from, msg.key, 2000);
            
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const hasMedia = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage;
            
            if (!quoted && !hasMedia) {
                return sock.sendMessage(from, { 
                    text: `❌ Please reply to an image or video with this command\n\nExample: Reply to media with ${settings.prefix}tourl` 
                }, { quoted: msg });
            }

            let targetMessage = msg;
            if (quoted) {
                targetMessage = {
                    key: {
                        remoteJid: from,
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        participant: msg.message.extendedTextMessage.contextInfo.participant
                    },
                    message: quoted
                };
            }

            const messageType = Object.keys(targetMessage.message)[0];
            const isImage = messageType === 'imageMessage';
            const isVideo = messageType === 'videoMessage';
            const isDocument = messageType === 'documentMessage';
            
            if (!isImage && !isVideo && !isDocument) {
                return sock.sendMessage(from, { 
                    text: '❌ Only images, videos, and documents are supported!' 
                }, { quoted: msg });
            }

            const processingMsg = await sock.sendMessage(from, { 
                text: '⏳ Processing your media...' 
            }, { quoted: msg });

            let mediaBuffer;
            let directUrl;
            
            try {
                // Try to get direct URL first (for videos/files)
                directUrl = await getDirectMediaUrl(targetMessage, messageType);
                
                if (!directUrl) {
                    // Fallback to buffer download
                    mediaBuffer = await sock.downloadMediaMessage(targetMessage);
                    if (!mediaBuffer) {
                        throw new Error('Failed to download media');
                    }
                }
            } catch (downloadError) {
                console.error('Download error:', downloadError);
                await sock.sendMessage(from, { delete: processingMsg.key });
                return sock.sendMessage(from, { 
                    text: '❌ Failed to process media! Try with a different file.' 
                }, { quoted: msg });
            }

            let uploadUrl;
            let fileType;
            let fileSizeMB = 'N/A';

            try {
                if (directUrl) {
                    // Use direct WhatsApp URL for videos/files
                    uploadUrl = directUrl;
                    fileType = isVideo ? 'Video' : 'Document';
                    fileSizeMB = 'Direct URL';
                } else if (isImage) {
                    uploadUrl = await uploadImage(mediaBuffer);
                    fileType = 'Image';
                    fileSizeMB = (mediaBuffer.length / (1024 * 1024)).toFixed(2);
                } else {
                    const ext = isVideo ? 'mp4' : (targetMessage.message.documentMessage?.fileName?.split('.').pop() || 'bin');
                    const filename = `file_${Date.now()}.${ext}`;
                    uploadUrl = await uploadFile(mediaBuffer, filename);
                    fileType = isVideo ? 'Video' : 'Document';
                    fileSizeMB = (mediaBuffer.length / (1024 * 1024)).toFixed(2);
                }
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                await sock.sendMessage(from, { delete: processingMsg.key });
                
                if (directUrl) {
                    // If direct URL is available but upload failed, send the direct URL
                    return sock.sendMessage(from, { 
                        text: `⚠️ *Using Direct WhatsApp URL*\n\n📁 *Type:* ${fileType}\n🔗 *URL:* ${directUrl}\n\n*Note:* This URL may expire after some time.` 
                    }, { quoted: msg });
                }
                
                return sock.sendMessage(from, { 
                    text: '❌ Failed to upload media! All upload services are currently unavailable.' 
                }, { quoted: msg });
            }

            if (!uploadUrl) {
                await sock.sendMessage(from, { delete: processingMsg.key });
                return sock.sendMessage(from, { 
                    text: '❌ Upload failed - no URL returned' 
                }, { quoted: msg });
            }

            const successMessage = `✅ *Media Uploaded Successfully*\n\n` +
                                 `*Type:* ${fileType}\n` +
                                 `*Size:* ${fileSizeMB}${fileSizeMB !== 'Direct URL' ? ' MB' : ''}\n` +
                                 `*URL:* ${uploadUrl}\n\n` +
                                 `_Uploaded by ${settings.packname || 'Gabimaru'}_`;

            await sock.sendMessage(from, { delete: processingMsg.key });
            await sock.sendMessage(from, { 
                text: successMessage 
            }, { quoted: msg });

        } catch (error) {
            console.error('Tourl command error:', error);
            await sock.sendMessage(from, { 
                text: '❌ An unexpected error occurred. Please try again.' 
            }, { quoted: msg });
        }
    }
};