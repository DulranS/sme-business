// src/components/ContactForm.tsx
'use client';

import { useState } from 'react';
import { getFormFields,FormField } from '../config/form-config';
import { Button } from './ui/button';
import { Input } from './ui/form-elements';
import { Textarea } from './ui/form-elements';
import { Select } from './ui/form-elements';
import { Checkbox } from './ui/form-elements';
import { RadioGroup,RadioItem } from './ui/form-elements';

export default function ContactForm() {
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fields = getFormFields();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        setSubmitSuccess(true);
        setFormData({});
      } else {
        const errorData = await response.json();
        setSubmitError(errorData.message || 'Failed to submit form. Please try again.');
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
        <p className="text-gray-600">
          We've received your request and will contact you within 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => {
        const value = formData[field.name] || '';
        
        switch (field.type) {
          case 'text':
          case 'email':
          case 'phone':
            return (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id={field.id}
                  name={field.name}
                  type={field.type}
                  value={value as string}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </div>
            );
          
          case 'textarea':
            return (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  id={field.id}
                  name={field.name}
                  value={value as string}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </div>
            );
          
          case 'select':
            return (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <Select
                  id={field.id}
                  name={field.name}
                  value={value as string}
                  onChange={handleChange}
                  required={field.required}
                >
                  <option value="">Select an option</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            );
          
          case 'checkbox':
            return (
              <div key={field.id} className="flex items-start">
                <Checkbox
                  id={field.id}
                  name={field.name}
                  checked={!!value}
                  onChange={handleChange}
                />
                <label htmlFor={field.id} className="ml-2 text-sm text-gray-700">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
              </div>
            );
          
          case 'radio':
            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <RadioGroup
                  name={field.name}
                  value={value as string}
                  onChange={handleChange}
                  required={field.required}
                >
                  {field.options?.map((option) => (
                    <RadioItem
                      key={option.value}
                      value={option.value}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
              </div>
            );
          
          default:
            return null;
        }
      })}
      
      {submitError && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
          {submitError}
        </div>
      )}
      
      <Button 
        type="submit" 
        className="w-full py-3"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Request Free Quote'}
      </Button>
      
      <p className="text-xs text-gray-500 text-center mt-4">
        By submitting this form, you agree to our privacy policy and terms of service.
      </p>
    </form>
  );
}