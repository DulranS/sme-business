interface Order {
  id: number;
  customer_name: string;
  email?: string;
  phone: string;
  location: string;
  description: string;
  moq: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  images: string; // JSON string of OrderImage[]
  created_at: string;
  supplier_price?: string;
  supplier_description?: string;
}

const StatusUpdater: React.FC<{
  currentStatus: Order["status"];
  onUpdate: (status: Order["status"]) => void;
  loading?: boolean;
}> = ({ currentStatus, onUpdate, loading }) => {
  const statuses: Order["status"][] = ["pending", "in-progress", "completed", "cancelled"];
  return (
    <div className="flex items-center space-x-2">
        <span>Status : </span>
      {statuses.map((status) => (
        <button
          key={status}
          disabled={loading || currentStatus === status}
          onClick={() => onUpdate(status)}
          className={`
            px-3 py-1 rounded text-sm border
            ${currentStatus === status ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}
            disabled:opacity-50
          `}
        >
          {status}
        </button>
      ))}
    </div>
  );
};

export default StatusUpdater;