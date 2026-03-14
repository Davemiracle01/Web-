module.exports = {  
  command: ["acceptreq", "approveall"],  
  description: "Accept all pending join requests in a group",  
  isGroup: true,  
  isAdmin: true,  
  
  async run({ sock, msg, from }) {  
    try {  
      // Get list of pending join requests  
      const pending = await sock.groupRequestParticipantsList(from);  
  
      if (!pending || pending.length === 0) {  
        return sock.sendMessage(from, {  
          text: "✅ No pending join requests found."  
        }, { quoted: msg });  
      }  
  
      // Approve them all  
      for (const req of pending) {  
        await sock.groupRequestParticipantsUpdate(from, [req.jid], "approve");  
      }  
  
      await sock.sendMessage(from, {  
        text: `✅ Approved ${pending.length} join request(s).`  
      }, { quoted: msg });  
  
    } catch (err) {  
      console.error("❌ acceptreq error:", err);  
      await sock.sendMessage(from, {  
        text: `⚠️ Failed to approve requests: ${err.message || err}`  
      }, { quoted: msg });  
    }  
  }  
};