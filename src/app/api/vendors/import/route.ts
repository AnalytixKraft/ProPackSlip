import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFirstValue, readImportedRows } from '@/lib/import-sheet'
import {
  normalizeEmail,
  normalizeGstNumber,
  normalizeOptionalText,
  validateOptionalEmail,
  validateOptionalGstNumber,
  validateOptionalPhone,
} from '@/lib/validators'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ImportError = {
  row: number
  message: string
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload a CSV or Excel file.' }, { status: 400 })
    }

    const rows = await readImportedRows(file)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in the uploaded file.' }, { status: 400 })
    }

    const existing = await prisma.vendor.findMany({
      select: { id: true, name: true, gstNumber: true },
    })
    const nameToId = new Map(
      existing.map((vendor) => [vendor.name.trim().toLowerCase(), vendor.id] as const)
    )
    const gstToId = new Map(
      existing
        .filter((vendor) => vendor.gstNumber)
        .map((vendor) => [String(vendor.gstNumber).trim().toUpperCase(), vendor.id] as const)
    )

    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    const errors: ImportError[] = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const rowNumber = index + 2
      const hasAnyValue = Object.values(row).some((value) => value.trim().length > 0)
      if (!hasAnyValue) {
        skipped += 1
        continue
      }

      const name = readFirstValue(row, ['name', 'customer', 'customername', 'vendor']).trim()
      const address = readFirstValue(row, ['address', 'shipto']).trim()
      const gstNumber = normalizeGstNumber(
        readFirstValue(row, ['gst', 'gstnumber', 'gstno'])
      )
      const email = normalizeEmail(readFirstValue(row, ['email', 'mail']))
      const contactName = normalizeOptionalText(
        readFirstValue(row, ['contactname', 'contact', 'person', 'contactperson'])
      )
      const contactPhone = normalizeOptionalText(
        readFirstValue(row, ['phone', 'mobile', 'contactphone', 'phonenumber'])
      )

      if (!name || !address) {
        failed += 1
        errors.push({
          row: rowNumber,
          message: 'Customer name and address are required.',
        })
        continue
      }

      const emailError = validateOptionalEmail(email)
      if (emailError) {
        failed += 1
        errors.push({ row: rowNumber, message: emailError })
        continue
      }

      const phoneError = validateOptionalPhone(contactPhone)
      if (phoneError) {
        failed += 1
        errors.push({ row: rowNumber, message: phoneError })
        continue
      }

      const gstError = validateOptionalGstNumber(gstNumber)
      if (gstError) {
        failed += 1
        errors.push({ row: rowNumber, message: gstError })
        continue
      }

      const normalizedName = name.toLowerCase()
      const normalizedGst = gstNumber ? gstNumber.toUpperCase() : null
      const matchedId =
        (normalizedGst ? gstToId.get(normalizedGst) : undefined) ||
        nameToId.get(normalizedName)

      if (matchedId) {
        const updatedVendor = await prisma.vendor.update({
          where: { id: matchedId },
          data: {
            name,
            address,
            gstNumber,
            email,
            contactName,
            contactPhone,
            isActive: true,
          },
          select: { id: true, name: true, gstNumber: true },
        })
        nameToId.set(updatedVendor.name.trim().toLowerCase(), updatedVendor.id)
        if (updatedVendor.gstNumber) {
          gstToId.set(updatedVendor.gstNumber.trim().toUpperCase(), updatedVendor.id)
        }
        updated += 1
        continue
      }

      const createdVendor = await prisma.vendor.create({
        data: {
          name,
          address,
          gstNumber,
          email,
          contactName,
          contactPhone,
          isActive: true,
        },
        select: { id: true, name: true, gstNumber: true },
      })
      nameToId.set(createdVendor.name.trim().toLowerCase(), createdVendor.id)
      if (createdVendor.gstNumber) {
        gstToId.set(createdVendor.gstNumber.trim().toUpperCase(), createdVendor.id)
      }
      created += 1
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      failed,
      total: rows.length,
      errors: errors.slice(0, 30),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to import customers.' }, { status: 500 })
  }
}
