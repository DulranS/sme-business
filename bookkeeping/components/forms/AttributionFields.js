"use client";
import { AttributionSources, ConversionStages } from '../../types';

export default function AttributionFields({ formData, setFormData }) {
  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
        <span>🎯</span> Attribution & Conversion Tracking
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attribution Source
          </label>
          <select
            value={formData.attribution_source || 'direct'}
            onChange={(e) => setFormData({ ...formData, attribution_source: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(AttributionSources).map(([key, value]) => (
              <option key={value} value={value}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">How did this customer find you?</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conversion Stage
          </label>
          <select
            value={formData.conversion_stage || 'closed_won'}
            onChange={(e) => setFormData({ ...formData, conversion_stage: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(ConversionStages).map(([key, value]) => (
              <option key={value} value={value}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Current stage in sales funnel</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Campaign / Source Details (Optional)
        </label>
        <input
          type="text"
          value={formData.campaign_details || ''}
          onChange={(e) => setFormData({ ...formData, campaign_details: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Summer Sale 2026, Google Ads Campaign, Referral from John Doe"
        />
        <p className="text-xs text-gray-500 mt-1">Additional context for attribution analysis</p>
      </div>
    </div>
  );
}
