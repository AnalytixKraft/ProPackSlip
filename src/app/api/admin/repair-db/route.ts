import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const { ensureDatabaseSchema } = require('../../../../../desktop/lib/repair-database')

export async function POST() {
  try {
    const result = await ensureDatabaseSchema()
    const baseMessage = result.changed
      ? `Database repair applied ${result.appliedSteps.length} change${
          result.appliedSteps.length === 1 ? '' : 's'
        }.`
      : 'Database is already up to date.'

    const backupMessage = result.backupPath
      ? ` Backup created at ${result.backupPath}.`
      : ''

    return NextResponse.json({
      success: true,
      changed: result.changed,
      version: result.version,
      databasePath: result.databasePath,
      backupPath: result.backupPath,
      appliedSteps: result.appliedSteps,
      message: `${baseMessage}${backupMessage}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to repair database.',
      },
      { status: 500 }
    )
  }
}
