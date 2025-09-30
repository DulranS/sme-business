// Card Component
export const Card = ({ children, className, ...props }) => {
    return (
      <div
        className={`bg-white rounded-lg shadow-md ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  };
  
  // CardHeader Component
  export const CardHeader = ({ children, className, ...props }) => {
    return (
      <div
        className={`px-6 py-4 border-b ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  };
  
  // CardTitle Component
  export const CardTitle = ({ children, className, ...props }) => {
    return (
      <h3
        className={`text-lg font-bold ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  };
  
  // CardContent Component
  export const CardContent = ({ children, className, ...props }) => {
    return (
      <div
        className={`p-6 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  };
  
  // CardFooter Component
  export const CardFooter = ({ children, className, ...props }) => {
    return (
      <div
        className={`px-6 py-4 border-t ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  };
  