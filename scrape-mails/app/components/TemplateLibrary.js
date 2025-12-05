// src/components/TemplateLibrary.js
export default function TemplateLibrary({ templates, onSelect, selectedId }) {
  return (
    <div className="space-y-3">
      {templates.map(template => (
        <div 
          key={template.id}
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            selectedId === template.id 
              ? 'bg-blue-50 border border-primary' 
              : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
          }`}
          onClick={() => onSelect(template)}
        >
          <h3 className="font-medium">{template.name}</h3>
          <p className="text-sm text-gray-600 truncate">{template.subject}</p>
        </div>
      ))}
      
      <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary hover:text-primary transition-colors">
        + Create New Template
      </button>
    </div>
  );
}