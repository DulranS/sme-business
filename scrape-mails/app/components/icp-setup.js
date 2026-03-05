// app/components/icp-setup.js
'use client';
import { useState, useEffect } from 'react';

export default function ICPSetup({ userId, onConfigured }) {
  const [icp, setIcp] = useState({
    industry: '',
    companySize: '',
    geography: '',
    painPoint: '',
    trigger: '',
    targetCompanies: [],
    decisionMakerRoles: ['CEO', 'CTO', 'VP Sales', 'Marketing Director'],
    maxEmailsPerDay: 50,
    bounceThreshold: 5,
    unsubscribeThreshold: 1
  });
  
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [targetCompanyInput, setTargetCompanyInput] = useState({ name: '', website: '' });

  const industries = [
    'SaaS', 'Manufacturing', 'Healthcare', 'Financial Services', 
    'E-commerce', 'Education', 'Real Estate', 'Consulting',
    'Technology', 'Retail', 'Logistics', 'Construction'
  ];

  const companySizes = [
    '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
  ];

  const geographies = [
    'North America', 'Europe', 'APAC', 'Latin America', 'Middle East', 'Africa'
  ];

  const painPoints = [
    'Lead generation', 'Customer retention', 'Operational efficiency',
    'Sales productivity', 'Revenue growth', 'Cost reduction',
    'Digital transformation', 'Customer acquisition'
  ];

  const triggers = [
    'Recent funding', 'Hiring spree', 'Product launch', 
    'Leadership change', 'Market expansion', 'Partnership announcement'
  ];

  const decisionMakerOptions = [
    'CEO', 'CTO', 'VP Sales', 'Marketing Director', 'Head of Sales',
    'Sales Manager', 'Business Development Manager', 'Account Executive'
  ];

  useEffect(() => {
    if (userId) {
      fetchICPConfig();
    }
  }, [userId]);

  const fetchICPConfig = async () => {
    try {
      const response = await fetch(`/api/icp-config?userId=${userId}`);
      const data = await response.json();
      
      if (data.success && data.isConfigured) {
        setIcp(data.icp);
        setCurrentStep(4); // Already configured
      }
    } catch (error) {
      console.error('Failed to fetch ICP config:', error);
    }
  };

  const saveICPConfig = async () => {
    setIsConfiguring(true);
    
    try {
      const response = await fetch('/api/icp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, icpConfig: icp })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentStep(4);
        onConfigured && onConfigured(icp);
      } else {
        alert('Error saving ICP: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to save ICP:', error);
      alert('Failed to save ICP configuration');
    } finally {
      setIsConfiguring(false);
    }
  };

  const addTargetCompany = () => {
    if (targetCompanyInput.name && targetCompanyInput.website && icp.targetCompanies.length < 50) {
      setIcp(prev => ({
        ...prev,
        targetCompanies: [...prev.targetCompanies, { ...targetCompanyInput }]
      }));
      setTargetCompanyInput({ name: '', website: '' });
    }
  };

  const removeTargetCompany = (index) => {
    setIcp(prev => ({
      ...prev,
      targetCompanies: prev.targetCompanies.filter((_, i) => i !== index)
    }));
  };

  const toggleDecisionMakerRole = (role) => {
    setIcp(prev => ({
      ...prev,
      decisionMakerRoles: prev.decisionMakerRoles.includes(role)
        ? prev.decisionMakerRoles.filter(r => r !== role)
        : [...prev.decisionMakerRoles, role]
    }));
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Step 1: Define Your Ideal Customer Profile</h3>
        <p className="text-gray-600 mb-6">Focused targets convert far better than broad approaches.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Industry *</label>
          <select
            value={icp.industry}
            onChange={(e) => setIcp(prev => ({ ...prev, industry: e.target.value }))}
            className="w-full p-3 border rounded-lg"
            required
          >
            <option value="">Select Industry</option>
            {industries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Company Size *</label>
          <select
            value={icp.companySize}
            onChange={(e) => setIcp(prev => ({ ...prev, companySize: e.target.value }))}
            className="w-full p-3 border rounded-lg"
            required
          >
            <option value="">Select Size</option>
            {companySizes.map(size => (
              <option key={size} value={size}>{size} employees</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Geography *</label>
          <select
            value={icp.geography}
            onChange={(e) => setIcp(prev => ({ ...prev, geography: e.target.value }))}
            className="w-full p-3 border rounded-lg"
            required
          >
            <option value="">Select Geography</option>
            {geographies.map(geo => (
              <option key={geo} value={geo}>{geo}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Primary Pain Point *</label>
          <select
            value={icp.painPoint}
            onChange={(e) => setIcp(prev => ({ ...prev, painPoint: e.target.value }))}
            className="w-full p-3 border rounded-lg"
            required
          >
            <option value="">Select Pain Point</option>
            {painPoints.map(pain => (
              <option key={pain} value={pain}>{pain}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Trigger Event *</label>
          <select
            value={icp.trigger}
            onChange={(e) => setIcp(prev => ({ ...prev, trigger: e.target.value }))}
            className="w-full p-3 border rounded-lg"
            required
          >
            <option value="">Select Trigger</option>
            {triggers.map(trigger => (
              <option key={trigger} value={trigger}>{trigger}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCurrentStep(2)}
          disabled={!icp.industry || !icp.companySize || !icp.geography || !icp.painPoint || !icp.trigger}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-400"
        >
          Next: Target Companies →
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Step 2: Select Target Companies (Max 50)</h3>
        <p className="text-gray-600 mb-6">Small batch = manageable testing. Quality over quantity.</p>
      </div>

      <div className="border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Company Name"
            value={targetCompanyInput.name}
            onChange={(e) => setTargetCompanyInput(prev => ({ ...prev, name: e.target.value }))}
            className="p-2 border rounded"
          />
          <input
            type="url"
            placeholder="Website URL"
            value={targetCompanyInput.website}
            onChange={(e) => setTargetCompanyInput(prev => ({ ...prev, website: e.target.value }))}
            className="p-2 border rounded"
          />
          <button
            onClick={addTargetCompany}
            disabled={!targetCompanyInput.name || !targetCompanyInput.website || icp.targetCompanies.length >= 50}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Add Company
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-2">
          {icp.targetCompanies.length}/50 companies added
        </div>

        <div className="max-h-60 overflow-y-auto">
          {icp.targetCompanies.map((company, index) => (
            <div key={index} className="flex justify-between items-center p-2 border-b">
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-sm text-gray-600">{company.website}</div>
              </div>
              <button
                onClick={() => removeTargetCompany(index)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(1)}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg"
        >
          ← Back
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          disabled={icp.targetCompanies.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-400"
        >
          Next: Decision Makers →
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Step 3: Decision Maker Roles</h3>
        <p className="text-gray-600 mb-6">Multi-threading reduces deal risk. Target 1-2 roles per company.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {decisionMakerOptions.map(role => (
          <label key={role} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={icp.decisionMakerRoles.includes(role)}
              onChange={() => toggleDecisionMakerRole(role)}
              className="rounded"
            />
            <span>{role}</span>
          </label>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-2">Send Safety Rules</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Max Emails/Day</label>
            <input
              type="number"
              min="10"
              max="100"
              value={icp.maxEmailsPerDay}
              onChange={(e) => setIcp(prev => ({ ...prev, maxEmailsPerDay: parseInt(e.target.value) }))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bounce Threshold (%)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={icp.bounceThreshold}
              onChange={(e) => setIcp(prev => ({ ...prev, bounceThreshold: parseInt(e.target.value) }))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unsubscribe Threshold (%)</label>
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={icp.unsubscribeThreshold}
              onChange={(e) => setIcp(prev => ({ ...prev, unsubscribeThreshold: parseFloat(e.target.value) }))}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(2)}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg"
        >
          ← Back
        </button>
        <button
          onClick={() => setCurrentStep(4)}
          disabled={icp.decisionMakerRoles.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-400"
        >
          Review & Launch →
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Review Your ICP Configuration</h3>
        <p className="text-gray-600 mb-6">Confirm your settings before launching the campaign.</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Target Profile</h4>
            <ul className="space-y-2 text-sm">
              <li><strong>Industry:</strong> {icp.industry}</li>
              <li><strong>Size:</strong> {icp.companySize} employees</li>
              <li><strong>Geography:</strong> {icp.geography}</li>
              <li><strong>Pain Point:</strong> {icp.painPoint}</li>
              <li><strong>Trigger:</strong> {icp.trigger}</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-3">Campaign Settings</h4>
            <ul className="space-y-2 text-sm">
              <li><strong>Target Companies:</strong> {icp.targetCompanies.length}</li>
              <li><strong>Decision Maker Roles:</strong> {icp.decisionMakerRoles.join(', ')}</li>
              <li><strong>Max Emails/Day:</strong> {icp.maxEmailsPerDay}</li>
              <li><strong>Bounce Threshold:</strong> {icp.bounceThreshold}%</li>
              <li><strong>Unsubscribe Threshold:</strong> {icp.unsubscribeThreshold}%</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Ready to Launch!</h4>
        <p className="text-blue-700 text-sm">
          Your ICP is configured. The system will now begin researching companies, 
          verifying emails, and launching your personalized outreach sequence.
        </p>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(3)}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg"
        >
          ← Back
        </button>
        <button
          onClick={saveICPConfig}
          disabled={isConfiguring}
          className="bg-green-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-400"
        >
          {isConfiguring ? 'Launching...' : 'Launch Campaign'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">ICP Configuration</h2>
        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4].map(step => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}
            >
              {step}
            </div>
          ))}
          <div className="flex-1 h-1 bg-gray-300 rounded">
            <div 
              className="h-1 bg-blue-600 rounded transition-all"
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
    </div>
  );
}
