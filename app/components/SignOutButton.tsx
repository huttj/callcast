'use client'

import { signOut } from "next-auth/react"

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
    >
      Sign Out
    </button>
  )
}
