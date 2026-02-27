// components/PreviewPane.js
export default function PreviewPane({ subject, body, previewData, sender, fieldMappings = {} }) {
  // Replace template variables using fieldMappings
  const replaceVars = (text) => {
    let result = text;
    Object.entries(fieldMappings).forEach(([varName, csvCol]) => {
      if (varName === 'sender_name') {
        result = result.replace(new RegExp(`{{\\s*${varName}\\s*}}`, 'g'), sender);
      } else if (csvCol && previewData[csvCol] !== undefined) {
        result = result.replace(new RegExp(`{{\\s*${varName}\\s*}}`, 'g'), previewData[csvCol]);
      } else {
        result = result.replace(new RegExp(`{{\\s*${varName}\\s*}}`, 'g'), `[MISSING: ${varName}]`);
      }
    });
    return result;
  };

  const finalSubject = replaceVars(subject);
  const finalBody = replaceVars(body);

  return (
    <div className="bg-gray-50 p-4 rounded border">
      <div className="text-sm text-gray-500">To: {previewData.email || 'recipient@example.com'}</div>
      <div className="font-medium mt-1">Subject: {finalSubject || <span className="text-gray-400">No subject</span>}</div>
      <div className="mt-3 whitespace-pre-wrap text-sm">
        {finalBody || <span className="text-gray-400">No body</span>}
      </div>
    </div>
  );
}