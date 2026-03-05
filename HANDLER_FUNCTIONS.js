// KEY HANDLER FUNCTIONS FOR ENHANCED DASHBOARD
// Add these functions to your page.js dashboard component

// ✅ HANDLE STATUS CHANGE FROM UI
const handleStatusChange = useCallback(async (contact, newStatus) => {
  if (!contact?.contactId) {
    console.error('Invalid contact for status change:', contact);
    return;
  }
  
  // Special handling for "not_interested" and "do_not_contact"
  if (['not_interested', 'do_not_contact'].includes(newStatus)) {
    const confirmed = confirm(
      `⚠️ Marking "${contact.business}" as "${newStatus}"\n\n` +
      `This will:\n` +
      `• Stop all automated follow-ups\n` +
      `• Archive contact after 30 days of inactivity\n` +
      `• Require manual reactivation to contact again\n\n` +
      `Are you sure?`
    );
    if (!confirmed) return;
  }
  
  // Show note modal for important status changes
  if (['not_interested', 'do_not_contact', 'closed_won', 'demo_scheduled'].includes(newStatus)) {
    setSelectedContactForStatus({ ...contact, newStatus });
    setStatusNote('');
    setShowStatusModal(true);
    return;
  }
  
  // Direct update for simple status changes
  await updateContactStatus(contact.contactId, newStatus);
}, [updateContactStatus]);

// ✅ HANDLE STATUS MODAL SUBMIT
const handleStatusModalSubmit = useCallback(async () => {
  if (!selectedContactForStatus?.contactId || !statusNote.trim()) {
    alert('Please add a note explaining this status change.');
    return;
  }
  
  const success = await updateContactStatus(
    selectedContactForStatus.contactId, 
    selectedContactForStatus.newStatus,
    statusNote.trim()
  );
  
  if (success) {
    setShowStatusModal(false);
    setSelectedContactForStatus(null);
    setStatusNote('');
  }
}, [selectedContactForStatus, statusNote, updateContactStatus]);

// ✅ RE-ENGAGE ARCHIVED CONTACTS
const reengageArchivedContacts = useCallback(async () => {
  if (!user?.uid) return;
  
  const confirmed = confirm(
    `🔄 Re-engage archived contacts?\n\n` +
    `This will:\n` +
    `• Restore ${archivedContactsCount} archived contacts to "New Lead" status\n` +
    `• Make them available for new outreach campaigns\n` +
    `• Reset their 30-day inactivity timer\n\n` +
    `Recommended only if you have a new offer or reason to contact them.`
  );
  
  if (!confirmed) return;
  
  try {
    setStatus('🔄 Re-engaging archived contacts...');
    const contactsRef = collection(db, 'users', user.uid, 'contacts');
    const q = query(
      contactsRef, 
      where('status', '==', 'archived'),
      where('lastUpdated', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    );
    const snapshot = await getDocs(q);
    
    let successCount = 0;
    for (const docSnap of snapshot.docs) {
      const contactData = docSnap.data();
      const contactId = contactData.email?.toLowerCase().trim() || `phone_${contactData.phone}`;
      
      await updateContactStatus(contactId, 'new', 'Re-engaged: New campaign initiated');
      successCount++;
    }
    
    setStatus(`✅ ${successCount} contacts re-engaged successfully!`);
    alert(`✅ ${successCount} archived contacts restored to "New Lead" status!`);
    
    // Reload contacts
    await loadContactsFromFirestore(user.uid);
    
  } catch (error) {
    console.error('Re-engagement error:', error);
    setStatus(`❌ Failed to re-engage contacts: ${error.message}`);
    alert(`Failed to re-engage contacts: ${error.message}`);
  }
}, [user, archivedContactsCount, updateContactStatus, loadContactsFromFirestore]);

// ✅ HANDLE TWILIO CALL WITH STATUS UPDATE
const handleTwilioCall = async (contact, callType = 'direct') => {
  // 🔒 SAFETY: Ensure contact is valid and has required fields
  if (!contact || !contact.phone || !contact.business) {
    console.warn('Invalid contact passed to handleTwilioCall:', contact);
    alert('❌ Contact data is incomplete. Cannot place call.');
    return;
  }
  if (!user?.uid) {
    alert('❌ You must be signed in to make calls.');
    return;
  }
  
  // ✅ UPDATE STATUS BEFORE CALL IF STILL "new"
  if (contact.status === 'new') {
    await updateContactStatus(contact.contactId, 'contacted', `Call initiated via ${callType} method`);
  }
  
  const callTypeLabels = {
    direct: 'Automated Message (Plays your script)',
    bridge: 'Bridge Call (Connects you first)',
    interactive: 'Interactive Menu (They can press buttons)'
  };
  
  const confirmed = confirm(
    `📞 Call ${contact.business} at +${contact.phone}?
Type: ${callTypeLabels[callType]}
Current Status: ${contact.status}
Click OK to proceed.`
  );
  
  if (!confirmed) return;
  
  try {
    setStatus(`📞 Initiating ${callType} call to ${contact.business}...`);
    setActiveCallStatus({
      business: contact.business,
      phone: contact.phone,
      status: 'initiating',
      timestamp: new Date().toISOString()
    });
    
    const response = await fetch('/api/make-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toPhone: contact.phone,
        businessName: contact.business,
        userId: user.uid,
        callType
      })
    });
    
    // ✅ CRITICAL: Check if response is valid JSON
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Invalid JSON from /api/make-call:', await response.text());
      throw new Error('Server returned an invalid response. Check Vercel logs.');
    }
    
    if (response.ok) {
      setStatus(`✅ Call initiated to ${contact.business}!
Call ID: ${data.callId}
Status: ${data.status}`);
      
      setActiveCallStatus({
        business: contact.business,
        phone: contact.phone,
        status: data.status,
        callId: data.callId,
        callSid: data.callSid,
        timestamp: new Date().toISOString()
      });
      
      alert(
        `✅ Call Successfully Initiated!
Business: ${contact.business}
Phone: +${contact.phone}
Type: ${callType}
Status: ${data.status}
Call ID: ${data.callId}`
      );
      
      // ✅ UPDATE LAST CONTACTED TIMESTAMP
      const contactKey = contact.email || contact.phone;
      setLastSent(prev => ({ ...prev, [contactKey]: new Date().toISOString() }));
      
      // ✅ UPDATE STATUS TO "contacted" IF NOT ALREADY
      if (!['contacted', 'engaged', 'replied'].includes(contact.status)) {
        await updateContactStatus(contact.contactId, 'contacted', `Call completed: ${data.status}`);
      }
      
      pollCallStatus(data.callId, contact.business);
    } else {
      const errorMsg = data.error || 'Unknown error';
      setStatus(`❌ Call Failed
Error: ${errorMsg}`);
      setActiveCallStatus({
        business: contact.business,
        phone: contact.phone,
        status: 'failed',
        error: errorMsg,
        timestamp: new Date().toISOString()
      });
      alert(`❌ Call Failed!
Business: ${contact.business}
Error: ${errorMsg}`);
    }
  } catch (error) {
    console.error('Twilio call error:', error);
    const userMessage = error.message || 'Network or server error. Check Vercel logs.';
    setStatus(`❌ ${userMessage}`);
    setActiveCallStatus({
      business: contact?.business || 'Unknown',
      phone: contact?.phone || 'Unknown',
      status: 'error',
      error: userMessage,
      timestamp: new Date().toISOString()
    });
    alert(`❌ ${userMessage}
Check browser console and Vercel function logs.`);
  }
};

// ✅ POLL CALL STATUS
const pollCallStatus = (callId, businessName) => {
  let attempts = 0;
  const maxAttempts = 20;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const callDoc = await getDoc(doc(db, 'calls', callId));
      if (callDoc.exists()) {
        const callData = callDoc.data();
        const status = callData.status;
        setActiveCallStatus(prev => ({
          ...prev,
          status: status,
          duration: callData.duration || 0,
          answeredBy: callData.answeredBy || 'unknown',
          updatedAt: callData.updatedAt
        }));
        
        if (status === 'ringing') {
          setStatus(`📞 Ringing ${businessName}...`);
        } else if (status === 'in-progress' || status === 'answered') {
          setStatus(`✅ Call connected to ${businessName}!
Duration: ${callData.duration || 0}s
Answered by: ${callData.answeredBy || 'unknown'}`);
        } else if (status === 'completed') {
          setStatus(`✅ Call Completed!
Business: ${businessName}
Duration: ${callData.duration || 0}s
Answered by: ${callData.answeredBy || 'unknown'}
${callData.recordingUrl ? '\n🎙️ Recording available' : ''}`);
          clearInterval(interval);
        } else if (status === 'failed' || status === 'busy' || status === 'no-answer') {
          setStatus(`❌ Call ${status}
Business: ${businessName}
Reason: ${status.toUpperCase()}`);
          clearInterval(interval);
        }
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setStatus(`⏱️ Status polling stopped after 2 minutes.
Check call history for final status.`);
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }, 6000);
};

// ✅ HANDLE WHATSAPP CLICK WITH STATUS UPDATE
const handleWhatsAppClick = useCallback(async (contact) => {
  if (contact.status === 'new') {
    await updateContactStatus(contact.contactId, 'contacted', 'WhatsApp message opened');
  }
}, [updateContactStatus]);

// ✅ HANDLE SMS SEND WITH STATUS UPDATE
const handleSendSMS = async (contact) => {
  if (!user?.uid) return;
  
  // ✅ UPDATE STATUS BEFORE SENDING
  if (contact.status === 'new') {
    await updateContactStatus(contact.contactId, 'contacted', 'SMS outreach initiated');
  }
  
  const confirmed = confirm(`Send SMS to ${contact.business} at +${contact.phone}?`);
  if (!confirmed) return;
  
  try {
    const message = renderPreviewText(
      smsTemplate,
      { business_name: contact.business, address: contact.address || '', phone_raw: contact.phone },
      fieldMappings,
      senderName
    );
    
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: contact.phone,
        message,
        businessName: contact.business,
        userId: user.uid
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      alert(`✅ SMS sent to ${contact.business}!`);
      const contactKey = contact.email || contact.phone;
      setLastSent(prev => ({ ...prev, [contactKey]: new Date().toISOString() }));
      
      // ✅ UPDATE STATUS IF NOT ALREADY CONTACTED
      if (!['contacted', 'engaged', 'replied'].includes(contact.status)) {
        await updateContactStatus(contact.contactId, 'contacted', 'SMS sent successfully');
      }
    } else {
      alert(`❌ SMS failed: ${data.error}`);
    }
  } catch (error) {
    console.error('SMS send error:', error);
    alert(`❌ Failed to send SMS: ${error.message}`);
  }
};

// ✅ STATUS BADGE COMPONENT
const StatusBadge = ({ status, small = false }) => {
  const statusDef = CONTACT_STATUSES.find(s => s.id === status) || CONTACT_STATUSES[0];
  const classes = `
    inline-flex items-center px-${small ? '1.5' : '2'} py-${small ? '0.5' : '1'} 
    rounded-full text-${small ? 'xs' : 'sm'} font-medium
    bg-${statusDef.color}-100 text-${statusDef.color}-800
    border border-${statusDef.color}-200
    transition-all duration-200
    hover:shadow-md hover:scale-[1.02]
  `;
  return (
    <span className={classes} title={statusDef.description}>
      {statusDef.label}
    </span>
  );
};

// ✅ STATUS DROPDOWN COMPONENT
const StatusDropdown = ({ contact, compact = false }) => {
  const currentStatus = contact.status || 'new';
  const statusDef = CONTACT_STATUSES.find(s => s.id === currentStatus) || CONTACT_STATUSES[0];
  
  return (
    <div className={`relative group ${compact ? 'w-full' : ''}`}>
      <select
        value={currentStatus}
        onChange={(e) => handleStatusChange(contact, e.target.value)}
        className={`
          ${compact 
            ? 'w-full py-1 text-xs' 
            : 'py-1.5 px-2 text-sm font-medium'}
          appearance-none
          bg-${statusDef.color}-50 
          text-${statusDef.color}-800
          border border-${statusDef.color}-300
          rounded-lg
          focus:outline-none focus:ring-2 focus:ring-${statusDef.color}-500 focus:border-${statusDef.color}-500
          cursor-pointer
          transition-all duration-200
          hover:bg-${statusDef.color}-100
        `}
        title={`Current status: ${statusDef.description}`}
      >
        {CONTACT_STATUSES.map(status => {
          // Only show valid transitions
          if (currentStatus !== 'archived' && 
              currentStatus !== status.id && 
              !STATUS_TRANSITIONS[currentStatus]?.includes(status.id)) {
            return null;
          }
          return (
            <option 
              key={status.id} 
              value={status.id}
              className="bg-white text-gray-900 hover:bg-blue-50"
            >
              {status.label}
            </option>
          );
        })}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-${statusDef.color}-700">
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
};

export {
  handleStatusChange,
  handleStatusModalSubmit,
  reengageArchivedContacts,
  handleTwilioCall,
  handleWhatsAppClick,
  handleSendSMS,
  StatusBadge,
  StatusDropdown
};
