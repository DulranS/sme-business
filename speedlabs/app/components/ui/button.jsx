export const Button = ({
    children,
    className,
    ...props
  }) => {
    return (
      <button
        className={`bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  };