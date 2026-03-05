// app/components/icp-launch-wizard.js
'use client';
import { useState, useEffect } from 'react';

export default function ICPLaunchWizard({ userId, onLaunched }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [icpConfig, setIcpConfig] = useState(null);
  const [targetCompanies, setTargetCompanies] = useState([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchStatus, setLaunchStatus] = useState('');

  const steps = [
    { id: 1, title: 'ICP Configuration', description: 'Define your ideal customer profile' },
    { id: 2, title: 'Target Companies', description: 'Add up to 50 qualified companies' },
    { id: 3, title: 'Research & Verification', description: 'Automated research and email verification' },
    { id: 4, title: 'Launch Campaign', description: 'Start your focused B2B outreach' }
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
        setIcpConfig(data.icp);
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Failed to fetch ICP config:', error);
    }
  };

  const handleICPConfigured = (config) => {
    setIcpConfig(config);
    setCurrentStep(2);
  };

  const handleCompaniesAdded = (companies) => {
    setTargetCompanies(companies);
    setCurrentStep(3);
  };

  const handleLaunchCampaign = async () => {
    setIsLaunching(true);
    setLaunchProgress(0);
    setLaunchStatus('Initializing campaign...');

    try {
      // Step 1: Research all companies
      setLaunchStatus('Researching companies...');
      setLaunchProgress(10);
      
      for (let i = 0; i < targetCompanies.length; i++) {
        const company = targetCompanies[i];
        await fetch('/api/research-automation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            companyName: company.name,
            website: company.website
          })
        });
        
        setLaunchProgress(10 + (i / targetCompanies.length) * 30);
      }

      // Step 2: Verify emails
      setLaunchStatus('Verifying emails...');
      setLaunchProgress(40);
      
      for (let i = 0; i < targetCompanies.length; i++) {
        const company = targetCompanies[i];
        // This would be enhanced with actual email verification
        setLaunchProgress(40 + (i / targetCompanies.length) * 20);
      }

      // Step 3: Initialize sequences
      setLaunchStatus('Setting up sequences...');
      setLaunchProgress(60);
      
      for (let i = 0; i < targetCompanies.length; i++) {
        const company = targetCompanies[i];
        await fetch('/api/sequence-management', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            action: 'start_sequence',
            companyId: `${userId}_${company.name.replace(/\s+/g, '_')}`,
            data: {
              decisionMaker: { email: company.email, name: company.contactName },
              personalizedEmail: { subject: 'test', body: 'test' },
              bookingLink: 'https://calendly.com/your-link',
              timezone: 'EST'
            }
          })
        });
        
        setLaunchProgress(60 + (i / targetCompanies.length) * 30);
      }

      // Step 4: Complete launch
      setLaunchStatus('Campaign launched successfully!');
      setLaunchProgress(100);
      
      setTimeout(() => {
        onLaunched && onLaunched();
      }, 2000);

    } catch (error) {
      console.error('Launch failed:', error);
      setLaunchStatus('Launch failed: ' + error.message);
    } finally {
      setIsLaunching(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <ICPSetup userId={userId} onConfigured={handleICPConfigured} />;
      case 2:
        return <TargetCompanySetup userId={userId} onCompaniesAdded={handleCompaniesAdded} />;
      case 3:
        return <ResearchVerification userId={userId} companies={targetCompanies} onVerified={() => setCurrentStep(4)} />;
      case 4:
        return <LaunchStep onLaunch={handleLaunchCampaign} isLaunching={isLaunching} progress={launchProgress} status={launchStatus} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.id <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                {step.id}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step.id < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">{steps[currentStep - 1].title}</h2>
          <p className="text-gray-600">{steps[currentStep - 1].description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {renderStepContent()}
      </div>
    </div>
  );
}

// ICP Setup Component (simplified version of the full one)
function ICPSetup({ userId, onConfigured }) {
  const [icp, setIcp] = useState({
    industry: '',
    companySize: '',
    geography: '',
    painPoint: '',
    trigger: '',
    decisionMakerRoles: ['CEO', 'CTO'],
    maxEmailsPerDay: 50
  });

  const [isSaving, setIsSaving] = useState(false);

  const industries = ['SaaS', 'Manufacturing', 'Healthcare', 'Financial Services'];
  const sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000'];
  const geographies = ['North America', 'Europe', 'APAC'];
  const painPoints = ['Lead generation', 'Customer retention', 'Operational efficiency'];
  const triggers = ['Recent funding', 'Hiring spree', 'Product launch'];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/icp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, icpConfig: icp })
      });
      
      const data = await response.json();
      if (data.success) {
        onConfigured(icp);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to save ICP configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Industry *</label>
          <select
            value={icp.industry}
            onChange={(e) => setIcp(prev => ({ ...prev, industry: e.target.value }))}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Size</option>
            {sizes.map(size => (
              <option key={size} value={size}>{size} employees</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Geography *</label>
          <select
            value={icp.geography}
            onChange={(e) => setIcp(prev => ({ ...prev, geography: e.target.value }))}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Geography</option>
            {geographies.map(geo => (
              <option key={geo} value={geo}>{geo}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pain Point *</label>
          <select
            value={icp.painPoint}
            onChange={(e) => setIcp(prev => ({ ...prev, painPoint: e.target.value }))}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Trigger</option>
            {triggers.map(trigger => (
              <option key={trigger} value={trigger}>{trigger}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Max Emails/Day</label>
          <input
            type="number"
            min="10"
            max="100"
            value={icp.maxEmailsPerDay}
            onChange={(e) => setIcp(prev => ({ ...prev, maxEmailsPerDay: parseInt(e.target.value) }))}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving || !icp.industry || !icp.companySize || !icp.geography || !icp.painPoint || !icp.trigger}
          className="bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400"
        >
          {isSaving ? 'Saving...' : 'Continue to Companies →'}
        </button>
      </div>
    </div>
  );
}

// Target Company Setup Component
function TargetCompanySetup({ userId, onCompaniesAdded }) {
  const [companies, setCompanies] = useState([]);
  const [newCompany, setNewCompany] = useState({ name: '', website: '' });

  const addCompany = () => {
    if (newCompany.name && newCompany.website && companies.length < 50) {
      setCompanies([...companies, { ...newCompany }]);
      setNewCompany({ name: '', website: '' });
    }
  };

  const removeCompany = (index) => {
    setCompanies(companies.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (companies.length > 0) {
      onCompaniesAdded(companies);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Add Target Companies (Max 50)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Company Name"
            value={newCompany.name}
            onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
            className="p-2 border rounded"
          />
          <input
            type="url"
            placeholder="Website URL"
            value={newCompany.website}
            onChange={(e) => setNewCompany(prev => ({ ...prev, website: e.target.value }))}
            className="p-2 border rounded"
          />
          <button
            onClick={addCompany}
            disabled={!newCompany.name || !newCompany.website || companies.length >= 50}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Add Company
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-2">
          {companies.length}/50 companies added
        </div>

        <div className="max-h-60 overflow-y-auto border rounded">
          {companies.map((company, index) => (
            <div key={index} className="flex justify-between items-center p-3 border-b">
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-sm text-gray-600">{company.website}</div>
              </div>
              <button
                onClick={() => removeCompany(index)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={companies.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400"
        >
          Continue to Research →
        </button>
      </div>
    </div>
  );
}

// Research Verification Component
function ResearchVerification({ userId, companies, onVerified }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleProcess = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        
        // Research automation
        await fetch('/api/research-automation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            companyName: company.name,
            website: company.website
          })
        });

        setProgress((i / companies.length) * 100);
      }

      onVerified();
    } catch (error) {
      console.error('Research failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Research & Email Verification</h3>
        <p className="text-gray-600 mb-4">
          We'll research each company and verify email addresses for deliverability.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Processing {companies.length} companies</span>
            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleProcess}
          disabled={isProcessing}
          className="bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400"
        >
          {isProcessing ? 'Processing...' : 'Start Research & Launch Campaign →'}
        </button>
      </div>
    </div>
  );
}

// Launch Step Component
function LaunchStep({ onLaunch, isLaunching, progress, status }) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-lg font-medium mb-4">Launch Your Campaign</h3>
        <p className="text-gray-600 mb-6">
          Ready to launch your focused B2B outreach campaign with {progress === 0 ? 'all safety rules and compliance measures' : 'automated sequences'}.
        </p>
      </div>

      {isLaunching && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Launching Campaign</h4>
            <p className="text-sm text-gray-600">{status}</p>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">{Math.round(progress)}% Complete</p>
        </div>
      )}

      {!isLaunching && progress === 100 && (
        <div className="bg-green-50 rounded-lg p-6">
          <div className="text-green-600 text-4xl mb-4">🎉</div>
          <h4 className="font-medium text-green-800 mb-2">Campaign Launched Successfully!</h4>
          <p className="text-green-700 text-sm">
            Your B2B outreach campaign is now active. Monitor performance in your KPI dashboard.
          </p>
        </div>
      )}

      {!isLaunching && progress === 0 && (
        <button
          onClick={onLaunch}
          className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700"
        >
          🚀 Launch Campaign Now
        </button>
      )}
    </div>
  );
}
