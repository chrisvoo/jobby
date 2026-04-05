import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

import type { ResumeData } from '@/lib/types'

export type { ResumeData }

const BLACK = '#000000'
const DARK = '#1a1a1a'
const MID = '#555555'
const RULE = '#bbbbbb'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    paddingHorizontal: 54,
    paddingVertical: 48,
    lineHeight: 1.5,
  },
  // ── Header ──────────────────────────────────────────────────
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    color: BLACK,
    marginBottom: 8,       // was 4 — breathing room under the large name
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 2,             // keeps wrapping contact lines readable
    fontSize: 9,
    color: MID,
    marginBottom: 10,
  },
  contactItem: { fontSize: 9, color: MID },
  headerRule: {
    borderBottomWidth: 1,
    borderBottomColor: DARK,
    marginBottom: 6,       // sectionTitle.marginTop picks up the rest of the gap
  },
  // ── Section ─────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: DARK,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingBottom: 3,      // was 2
    marginBottom: 8,       // was 6
    marginTop: 16,         // was 10 — clear gap between sections
  },
  // ── Summary ─────────────────────────────────────────────────
  summaryText: { fontSize: 10, color: DARK, lineHeight: 1.6 },
  // ── Experience ──────────────────────────────────────────────
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,       // was 1
  },
  expCompany: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  expDates: { fontSize: 9, color: MID },
  expRole: { fontSize: 10, color: DARK, marginTop: 1, marginBottom: 5 }, // was marginBottom 3
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,       // was 2
    paddingLeft: 8,
  },
  bulletDot: { fontSize: 10, marginRight: 4, color: DARK },
  bulletText: { flex: 1, fontSize: 10, color: DARK, lineHeight: 1.5 },
  expBlock: { marginBottom: 12 },  // was 8
  // ── Education ───────────────────────────────────────────────
  eduHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,       // was 1
  },
  eduInstitution: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  eduDates: { fontSize: 9, color: MID },
  eduDegree: { fontSize: 10, color: DARK, marginBottom: 2 },
  eduDetails: { fontSize: 9, color: MID, marginTop: 2 },  // was 1
  eduBlock: { marginBottom: 10 },  // was 6
  // ── Skills ──────────────────────────────────────────────────
  skillsText: { fontSize: 10, color: DARK, lineHeight: 1.5 },
  // ── Certifications ──────────────────────────────────────────
  certText: { fontSize: 10, color: DARK, lineHeight: 1.5 },
})

// ── Sub-components ───────────────────────────────────────────

function Header({ data }: { data: ResumeData }) {
  const contacts = [
    data.email,
    data.phone,
    data.location,
    data.linkedin,
    data.website,
  ].filter(Boolean) as string[]

  return (
    <>
      <Text style={s.name}>{data.name}</Text>
      {contacts.length > 0 && (
        <View style={s.contactRow}>
          {contacts.map((c, i) => (
            <Text key={i} style={s.contactItem}>{c}</Text>
          ))}
        </View>
      )}
      <View style={s.headerRule} />
    </>
  )
}

function Summary({ text }: { text: string }) {
  return (
    <>
      <Text style={s.sectionTitle}>Summary</Text>
      <Text style={s.summaryText}>{text}</Text>
    </>
  )
}

function Experience({ items }: { items: ResumeData['experience'] }) {
  return (
    <>
      <Text style={s.sectionTitle}>Experience</Text>
      {items.map((exp, i) => (
        <View key={i} style={s.expBlock} wrap={false}>
          <View style={s.expHeader}>
            <Text style={s.expCompany}>{exp.company}</Text>
            <Text style={s.expDates}>{exp.dates}</Text>
          </View>
          <Text style={s.expRole}>
            {exp.role}{exp.location ? `  ·  ${exp.location}` : ''}
          </Text>
          {exp.bullets.map((b, j) => (
            <View key={j} style={s.bullet}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  )
}

function Education({ items }: { items: ResumeData['education'] }) {
  return (
    <>
      <Text style={s.sectionTitle}>Education</Text>
      {items.map((edu, i) => (
        <View key={i} style={s.eduBlock} wrap={false}>
          <View style={s.eduHeader}>
            <Text style={s.eduInstitution}>{edu.institution}</Text>
            <Text style={s.eduDates}>{edu.dates}</Text>
          </View>
          <Text style={s.eduDegree}>{edu.degree}</Text>
          {edu.details && <Text style={s.eduDetails}>{edu.details}</Text>}
        </View>
      ))}
    </>
  )
}

function Skills({ items }: { items: string[] }) {
  return (
    <>
      <Text style={s.sectionTitle}>Skills</Text>
      <Text style={s.skillsText}>{items.join('  ·  ')}</Text>
    </>
  )
}

function Certifications({ items }: { items: string[] }) {
  return (
    <>
      <Text style={s.sectionTitle}>Certifications</Text>
      <Text style={s.certText}>{items.join('  ·  ')}</Text>
    </>
  )
}

function ResumeDoc({ data }: { data: ResumeData }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        {data.summary && <Summary text={data.summary} />}
        {data.experience.length > 0 && <Experience items={data.experience} />}
        {data.education.length > 0 && <Education items={data.education} />}
        {data.skills.length > 0 && <Skills items={data.skills} />}
        {data.certifications && data.certifications.length > 0 && (
          <Certifications items={data.certifications} />
        )}
      </Page>
    </Document>
  )
}

export async function generateResumePDF(data: ResumeData): Promise<Buffer> {
  return renderToBuffer(<ResumeDoc data={data} />) as Promise<Buffer>
}
