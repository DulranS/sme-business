// src/components/SendEmailsModal.js
export default function SendEmailsModal({ recipientsCount, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Confirm Email Send</h3>
        <p className="mb-6 text-gray-600">
          You're about to send emails to <span className="font-semibold">{recipientsCount} recipients</span>. 
          This will use your Gmail account and send at a rate of 1 email/second to avoid spam filters.
        </p>
        
        <div className="flex space-x-3">
          <button 
            onClick={onConfirm}
            className="flex-1 btn btn-primary py-2.5"
          >
            Confirm Send
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 btn btn-outline py-2.5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}