import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Upload, X, Plus, Shield, Clock, MessageSquare } from 'lucide-react';
import { OrderFormData, OrderImage } from '@/types';
import { orderService } from '@/lib/services/orders';

interface OrderFormProps {
  onSuccess?: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: '',
    email: '',
    phone: '',
    location: '',
    description: '',
    moq: '',
    urgency: 'medium',
    images: [],
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (event.target?.result) {
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, { name: file.name, url: event.target!.result as string }],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number): void => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const clearForm = () => {
    setFormData({
      customer_name: '',
      email: '',
      phone: '',
      location: '',
      description: '',
      moq: '',
      urgency: 'medium',
      images: [],
      category: '',
    });
  };

  const submitOrder = async (): Promise<void> => {
    if (
      !formData.customer_name ||
      !formData.phone ||
      !formData.location ||
      !formData.description ||
      !formData.moq ||
      !formData.category
    ) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await orderService.createOrder(formData);
      clearForm();
      alert('✅ Order submitted successfully! We will get back to you soon.');
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('❌ Error submitting order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <h2 className="text-2xl font-bold">Your Sourcing Details</h2>
        <p className="text-blue-100 mt-1 text-sm">
          Provide as much detail as possible to receive the most accurate supplier matches.
        </p>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {/* Contact Info */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Contact Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Sarah Johnson"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email (Optional but Recommended)</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@company.com"
              />
              <p className="text-xs text-gray-500 mt-1">We'll send updates here</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1 234 567 8900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
              <select
                name="urgency"
                value={formData.urgency}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Standard (5–7 days)</option>
                <option value="medium">Medium (3–5 days)</option>
                <option value="high">Urgent (1–2 days)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location *</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Full address or city, country"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Helps us find local or regionally compliant suppliers</p>
          </div>
        </div>

        {/* Order Details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Product or Service Requirements</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Order Quantity (MOQ) *
              </label>
              <input
                type="text"
                name="moq"
                value={formData.moq}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 500 units, 2 tons, 100 sets"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Be specific about units, packaging, and tolerances</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Solar Panels, Lab Coats, CNC Machined Parts..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Be as specific as possible (e.g., "Biodegradable Food Containers" vs. "Packaging")
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Detailed Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe materials, dimensions, certifications, standards, samples needed, etc."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The more detail you provide, the better we can match you with qualified suppliers.
            </p>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reference Images (Optional but Helpful)</h3>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Upload sketches, samples, or reference photos (max 5)</p>
          </button>

          {formData.images.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">Uploaded Images:</h4>
                <button
                  onClick={clearForm}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {formData.images.slice(0, 5).map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit & Clear Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button
            variant="secondary"
            onClick={clearForm}
            className="flex-1"
          >
            Clear Form
          </Button>
          <Button
            variant="primary"
            onClick={submitOrder}
            disabled={loading}
            className="flex-1"
            icon={<Plus className="w-4 h-4" />}
          >
            {loading ? 'Processing Request...' : 'Submit Sourcing Request'}
          </Button>
        </div>

        {/* Final Reassurance */}
        <div className="pt-4 text-center text-sm text-gray-600 border-t border-gray-100">
          <p>
            ✅ <strong>No cost to submit.</strong> We'll contact you with supplier options within 1–2 business days.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
