// src/components/EmailEditor.js
import { useState, useRef } from 'react';

export default function EmailEditor({ template, onChange, fields = [] }) {
  const textareaRef = useRef(null);
  
  const handleInputChange = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }));
  };
  
  const insertPlaceholder = (placeholder) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = template.body.substring(0, start) + 
                    `{{${placeholder}}}` + 
                    template.body.substring(end);
    
    handleInputChange('body', newBody);
    
    setTimeout(() => {
      textarea.focus();
      const newPos = start + placeholder.length + 4;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };
  
  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Subject
        </label>
        <input
          type="text"
          value={template.subject}
          onChange={(e) => handleInputChange('subject', e.target.value)}
          className="input"
          placeholder="Enter email subject"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Body
        </label>
        <div className="flex mb-2">
          <div className="flex space-x-1 overflow-x-auto pb-1">
            {fields.map(field => (
              <button
                key={field}
                type="button"
                onClick={() => insertPlaceholder(field)}
                className="tag"
              >
                {field} {/* ✅ Fixed: just render the string */}
              </button>
            ))}
            <button
              type="button"
              onClick={() => insertPlaceholder('sender_name')}
              className="tag"
            >
              sender_name
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="textarea email-body-input"
          value={template.body}
          onChange={(e) => handleInputChange('body', e.target.value)}
          placeholder="Enter email body. Use {{placeholder}} for dynamic fields."
        />
      </div>
      
      {fields.length > 0 && (
        <div className="text-sm text-gray-600 mt-2">
          <p>
            Available placeholders:{' '}
            {fields.map(f => `{{${f}}}`).join(', ')}
            {' and {{sender_name}}'}
          </p>
        </div>
      )}
    </div>
  );
}