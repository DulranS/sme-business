// Alert Component
export const Alert = ({ children, className, ...props }) => {
    return (
      <div
        className={`bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded ${className}`}
        role="alert"
        {...props}
      >
        {children}
      </div>
    );
  };
  
  // AlertTitle Component
  export const AlertTitle = ({ children, className, ...props }) => {
    return (
      <strong className={`font-bold ${className}`} {...props}>
        {children}
      </strong>
    );
  };
  
  // AlertDescription Component
  export const AlertDescription = ({ children, className, ...props }) => {
    return (
      <p className={`${className}`} {...props}>
        {children}
      </p>
    );
  };