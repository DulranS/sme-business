import { Fragment, useState, useEffect } from 'react'
import { Transition as HeadlessTransition } from '@headlessui/react'

export const Transition = ({ show, as = Fragment, children, ...props }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <HeadlessTransition
      as={as}
      show={mounted ? show : false}
      enter="transition ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition ease-in duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      {...props}
    >
      {children}
    </HeadlessTransition>
  )
}

