export const Input = ({
    id,
    label,
    value,
    onChange,
    type = 'text',
    className,
    ...props
  }) => {
    return (
      <div className={`mb-4 ${className}`}>
        <label htmlFor={id} className="block font-medium mb-2">
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          {...props}
        />
      </div>
    );
  };