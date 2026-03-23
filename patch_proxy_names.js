const PROJECT_ID = "brainbridge-4b8ac";
const APP_ID = "default-app-id";

async function run() {
    try {
        console.log("Fetching events from Firestore REST...");
        const eventsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/events`;
        
        const res = await fetch(eventsUrl);
        const result = await res.json();
        
        if(!result.documents) return console.log("No events to patch.");

        for(const d of result.documents) {
            const fields = d.fields || {};
            if(fields.organizerName && fields.organizerName.stringValue === '代理投稿') {
                const docName = d.name; // full resource name
                const orgId = fields.organizerId ? fields.organizerId.stringValue : null;
                if(orgId) {
                    console.log(`Found corrupted event: ${docName}, organizerId: ${orgId}`);
                    
                    // Fetch real user name
                    const userUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${orgId}`;
                    const uRes = await fetch(userUrl);
                    const uDoc = await uRes.json();
                    
                    let realName = '投稿者';
                    if(uDoc.fields) {
                        realName = (uDoc.fields.name && uDoc.fields.name.stringValue) || (uDoc.fields.userId && uDoc.fields.userId.stringValue) || '投稿者';
                    }
                    console.log(`Resolved real name: ${realName}`);
                    
                    // Patch
                    const patchBody = {
                        fields: {
                            organizerName: { stringValue: realName }
                        }
                    };
                    const updateMask = "?updateMask.fieldPaths=organizerName";
                    
                    const patchRes = await fetch("https://firestore.googleapis.com/v1/" + docName + updateMask, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(patchBody)
                    });
                    
                    if (patchRes.ok) {
                        console.log('Successfully patched.');
                    } else {
                        console.error('Failed to patch:', await patchRes.text());
                    }
                }
            }
        }
        console.log("Done.");
    } catch(e) {
        console.error(e);
    }
}

run();
