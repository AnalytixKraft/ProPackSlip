'use client'

type PrintButtonProps = {
  label?: string
}

export default function PrintButton({ label = 'Print' }: PrintButtonProps) {
  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      {label}
    </button>
  )
}
