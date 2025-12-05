// src/components/PreviewPane.js
export default function PreviewPane({ subject, body, previewData, sender }) {
  // Replace placeholders with actual data
  const renderSubject = () => {
    let result = subject;
    if (previewData) {
      Object.keys(previewData).forEach(key => {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), previewData[key] || `{{${key}}}`);
      });
    }
    result = result.replace(/{{sender_name}}/g, sender.split('@')[0]);
    return result;
  };
  
  const renderBody = () => {
    let result = body;
    if (previewData) {
      Object.keys(previewData).forEach(key => {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), previewData[key] || `{{${key}}}`);
      });
    }
    result = result.replace(/{{sender_name}}/g, sender.split('@')[0]);
    return result.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>);
  };
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b">
        <p className="text-sm text-gray-600">To: {previewData?.email || 'recipient@example.com'}</p>
        <p className="font-medium truncate">Subject: {renderSubject() || 'No subject'}</p>
      </div>
      <div className="p-4 bg-white min-h-[200px]">
        {renderBody()}
      </div>
      <div className="bg-gray-100 px-4 py-2 border-t text-sm text-gray-600">
        Sent from: {sender}
      </div>
    </div>
  );
}