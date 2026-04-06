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
import type { TemplateId } from '@/lib/resume-templates'

export type { ResumeData }

// ─────────────────────────────────────────────────────────────────────────────
// Shared colour palette
// ─────────────────────────────────────────────────────────────────────────────

const BLACK   = '#000000'
const DARK    = '#1a1a1a'
const MID     = '#555555'
const RULE    = '#bbbbbb'
const ACCENT  = '#6366f1'   // indigo — used by modern + sidebar
const SIDEBAR_BG = '#f4f4f5' // zinc-100 equivalent for sidebar left column

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL template
// ─────────────────────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    paddingHorizontal: 54,
    paddingVertical: 48,
    lineHeight: 1.5,
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    color: BLACK,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 2,
    fontSize: 9,
    color: MID,
    marginBottom: 10,
  },
  contactItem: { fontSize: 9, color: MID },
  headerRule: {
    borderBottomWidth: 1,
    borderBottomColor: DARK,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: DARK,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingBottom: 3,
    marginBottom: 8,
    marginTop: 16,
  },
  summaryText: { fontSize: 10, color: DARK, lineHeight: 1.6 },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  expCompany: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  expDates: { fontSize: 9, color: MID },
  expRole: { fontSize: 10, color: DARK, marginTop: 1, marginBottom: 5 },
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: { fontSize: 10, marginRight: 4, color: DARK },
  bulletText: { flex: 1, fontSize: 10, color: DARK, lineHeight: 1.5 },
  expBlock: { marginBottom: 12 },
  eduHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  eduInstitution: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  eduDates: { fontSize: 9, color: MID },
  eduDegree: { fontSize: 10, color: DARK, marginBottom: 2 },
  eduDetails: { fontSize: 9, color: MID, marginTop: 2 },
  eduBlock: { marginBottom: 10 },
  skillsText: { fontSize: 10, color: DARK, lineHeight: 1.5 },
  certText: { fontSize: 10, color: DARK, lineHeight: 1.5 },
})

function MinimalHeader({ data }: { data: ResumeData }) {
  const contacts = [
    data.email, data.phone, data.location, data.linkedin, data.website,
  ].filter(Boolean) as string[]

  return (
    <>
      <Text style={ms.name}>{data.name}</Text>
      {contacts.length > 0 && (
        <View style={ms.contactRow}>
          {contacts.map((c, i) => <Text key={i} style={ms.contactItem}>{c}</Text>)}
        </View>
      )}
      <View style={ms.headerRule} />
    </>
  )
}

function MinimalDoc({ data }: { data: ResumeData }) {
  return (
    <Document>
      <Page size="LETTER" style={ms.page}>
        <MinimalHeader data={data} />
        {data.summary && (
          <>
            <Text style={ms.sectionTitle}>Summary</Text>
            <Text style={ms.summaryText}>{data.summary}</Text>
          </>
        )}
        {data.experience.length > 0 && (
          <>
            <Text style={ms.sectionTitle}>Experience</Text>
            {data.experience.map((exp, i) => (
              <View key={i} style={ms.expBlock} wrap={false}>
                <View style={ms.expHeader}>
                  <Text style={ms.expCompany}>{exp.company}</Text>
                  <Text style={ms.expDates}>{exp.dates}</Text>
                </View>
                <Text style={ms.expRole}>
                  {exp.role}{exp.location ? `  ·  ${exp.location}` : ''}
                </Text>
                {exp.bullets.map((b, j) => (
                  <View key={j} style={ms.bullet}>
                    <Text style={ms.bulletDot}>•</Text>
                    <Text style={ms.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
        {data.education.length > 0 && (
          <>
            <Text style={ms.sectionTitle}>Education</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={ms.eduBlock} wrap={false}>
                <View style={ms.eduHeader}>
                  <Text style={ms.eduInstitution}>{edu.institution}</Text>
                  <Text style={ms.eduDates}>{edu.dates}</Text>
                </View>
                <Text style={ms.eduDegree}>{edu.degree}</Text>
                {edu.details && <Text style={ms.eduDetails}>{edu.details}</Text>}
              </View>
            ))}
          </>
        )}
        {data.skills.length > 0 && (
          <>
            <Text style={ms.sectionTitle}>Skills</Text>
            <Text style={ms.skillsText}>{data.skills.join('  ·  ')}</Text>
          </>
        )}
        {data.certifications && data.certifications.length > 0 && (
          <>
            <Text style={ms.sectionTitle}>Certifications</Text>
            <Text style={ms.certText}>{data.certifications.join('  ·  ')}</Text>
          </>
        )}
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR template  (two-column)
// ─────────────────────────────────────────────────────────────────────────────

const sb = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    lineHeight: 1.5,
  },
  // Header strip spanning full width
  headerStrip: {
    backgroundColor: ACCENT,
    paddingHorizontal: 32,
    paddingVertical: 22,
  },
  headerName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: '#ffffff',
    marginBottom: 6,
  },
  headerContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 2,
  },
  headerContactItem: { fontSize: 9, color: 'rgba(255,255,255,0.85)' },
  // Body — two columns
  body: {
    flexDirection: 'row',
    flex: 1,
  },
  // Left sidebar
  sidebar: {
    width: '30%',
    backgroundColor: SIDEBAR_BG,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  sidebarSection: { marginBottom: 18 },
  sidebarTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: ACCENT,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT,
    paddingBottom: 3,
  },
  sidebarText: { fontSize: 9, color: DARK, lineHeight: 1.5 },
  sidebarSkillItem: { fontSize: 9, color: DARK, marginBottom: 3 },
  // Right main column
  main: {
    width: '70%',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  mainSectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: DARK,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingBottom: 3,
    marginBottom: 8,
    marginTop: 14,
  },
  summaryText: { fontSize: 10, color: DARK, lineHeight: 1.6 },
  expBlock: { marginBottom: 12 },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  expCompany: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  expDates: { fontSize: 9, color: MID },
  expRole: { fontSize: 9, color: MID, marginBottom: 4, fontFamily: 'Helvetica-Oblique' },
  bullet: { flexDirection: 'row', marginBottom: 3, paddingLeft: 6 },
  bulletDot: { fontSize: 10, marginRight: 4, color: ACCENT },
  bulletText: { flex: 1, fontSize: 10, color: DARK, lineHeight: 1.5 },
  eduBlock: { marginBottom: 10 },
  eduHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  eduInstitution: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  eduDates: { fontSize: 9, color: MID },
  eduDegree: { fontSize: 10, color: DARK, marginBottom: 2 },
  eduDetails: { fontSize: 9, color: MID },
})

function SidebarDoc({ data }: { data: ResumeData }) {
  const contacts = [
    data.email, data.phone, data.location, data.linkedin, data.website,
  ].filter(Boolean) as string[]

  return (
    <Document>
      <Page size="LETTER" style={sb.page}>
        {/* Full-width accent header */}
        <View style={sb.headerStrip} fixed>
          <Text style={sb.headerName}>{data.name}</Text>
          {contacts.length > 0 && (
            <View style={sb.headerContactRow}>
              {contacts.map((c, i) => (
                <Text key={i} style={sb.headerContactItem}>{c}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Two-column body */}
        <View style={sb.body}>
          {/* Left sidebar */}
          <View style={sb.sidebar}>
            {data.skills.length > 0 && (
              <View style={sb.sidebarSection}>
                <Text style={sb.sidebarTitle}>Skills</Text>
                {data.skills.map((s, i) => (
                  <Text key={i} style={sb.sidebarSkillItem}>• {s}</Text>
                ))}
              </View>
            )}
            {data.certifications && data.certifications.length > 0 && (
              <View style={sb.sidebarSection}>
                <Text style={sb.sidebarTitle}>Certifications</Text>
                {data.certifications.map((c, i) => (
                  <Text key={i} style={sb.sidebarSkillItem}>• {c}</Text>
                ))}
              </View>
            )}
            {data.education.length > 0 && (
              <View style={sb.sidebarSection}>
                <Text style={sb.sidebarTitle}>Education</Text>
                {data.education.map((edu, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <Text style={[sb.sidebarText, { fontFamily: 'Helvetica-Bold' }]}>{edu.institution}</Text>
                    <Text style={sb.sidebarText}>{edu.degree}</Text>
                    <Text style={[sb.sidebarText, { color: MID }]}>{edu.dates}</Text>
                    {edu.details && <Text style={[sb.sidebarText, { color: MID }]}>{edu.details}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Right main content */}
          <View style={sb.main}>
            {data.summary && (
              <>
                <Text style={[sb.mainSectionTitle, { marginTop: 0 }]}>Summary</Text>
                <Text style={sb.summaryText}>{data.summary}</Text>
              </>
            )}
            {data.experience.length > 0 && (
              <>
                <Text style={sb.mainSectionTitle}>Experience</Text>
                {data.experience.map((exp, i) => (
                  <View key={i} style={sb.expBlock} wrap={false}>
                    <View style={sb.expHeader}>
                      <Text style={sb.expCompany}>{exp.company}</Text>
                      <Text style={sb.expDates}>{exp.dates}</Text>
                    </View>
                    <Text style={sb.expRole}>
                      {exp.role}{exp.location ? `  ·  ${exp.location}` : ''}
                    </Text>
                    {exp.bullets.map((b, j) => (
                      <View key={j} style={sb.bullet}>
                        <Text style={sb.bulletDot}>•</Text>
                        <Text style={sb.bulletText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODERN ACCENT template  (single-column with indigo accents)
// ─────────────────────────────────────────────────────────────────────────────

const mo = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    paddingHorizontal: 50,
    paddingVertical: 44,
    lineHeight: 1.5,
  },
  // Header
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 26,
    color: ACCENT,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 12,
    color: MID,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 0,
    fontSize: 9,
    color: MID,
    marginBottom: 14,
  },
  contactSep: { fontSize: 9, color: RULE, marginHorizontal: 6 },
  contactItem: { fontSize: 9, color: MID },
  headerRule: {
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    marginBottom: 14,
  },
  // Section titles — left accent border
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: DARK,
    marginBottom: 8,
    marginTop: 18,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  summaryText: { fontSize: 10, color: DARK, lineHeight: 1.7 },
  // Experience
  expBlock: { marginBottom: 14 },
  expHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 1,
  },
  expCompany: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: BLACK },
  expDates: {
    fontSize: 9,
    color: '#ffffff',
    backgroundColor: ACCENT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  expRole: {
    fontSize: 10,
    color: MID,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 5,
  },
  bullet: { flexDirection: 'row', marginBottom: 3, paddingLeft: 10 },
  bulletDot: { fontSize: 10, marginRight: 5, color: ACCENT },
  bulletText: { flex: 1, fontSize: 10, color: DARK, lineHeight: 1.5 },
  // Education
  eduBlock: { marginBottom: 10 },
  eduRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  eduInstitution: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BLACK },
  eduDates: { fontSize: 9, color: MID },
  eduDegree: { fontSize: 10, color: MID, fontFamily: 'Helvetica-Oblique' },
  eduDetails: { fontSize: 9, color: MID, marginTop: 1 },
  // Skills — pill-style grid
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillPill: {
    fontSize: 9,
    color: ACCENT,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  certText: { fontSize: 10, color: DARK, lineHeight: 1.5 },
})

function ModernDoc({ data }: { data: ResumeData }) {
  const contacts = [
    data.email, data.phone, data.location, data.linkedin, data.website,
  ].filter(Boolean) as string[]

  return (
    <Document>
      <Page size="LETTER" style={mo.page}>
        {/* Header */}
        <Text style={mo.name}>{data.name}</Text>
        {contacts.length > 0 && (
          <View style={mo.contactRow}>
            {contacts.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Text style={mo.contactSep}>|</Text>}
                <Text style={mo.contactItem}>{c}</Text>
              </React.Fragment>
            ))}
          </View>
        )}
        <View style={mo.headerRule} />

        {/* Summary */}
        {data.summary && (
          <>
            <Text style={mo.sectionTitle}>Summary</Text>
            <Text style={mo.summaryText}>{data.summary}</Text>
          </>
        )}

        {/* Experience */}
        {data.experience.length > 0 && (
          <>
            <Text style={mo.sectionTitle}>Experience</Text>
            {data.experience.map((exp, i) => (
              <View key={i} style={mo.expBlock} wrap={false}>
                <View style={mo.expHeaderRow}>
                  <Text style={mo.expCompany}>{exp.company}</Text>
                  <Text style={mo.expDates}>{exp.dates}</Text>
                </View>
                <Text style={mo.expRole}>
                  {exp.role}{exp.location ? `  ·  ${exp.location}` : ''}
                </Text>
                {exp.bullets.map((b, j) => (
                  <View key={j} style={mo.bullet}>
                    <Text style={mo.bulletDot}>›</Text>
                    <Text style={mo.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* Education */}
        {data.education.length > 0 && (
          <>
            <Text style={mo.sectionTitle}>Education</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={mo.eduBlock} wrap={false}>
                <View style={mo.eduRow}>
                  <Text style={mo.eduInstitution}>{edu.institution}</Text>
                  <Text style={mo.eduDates}>{edu.dates}</Text>
                </View>
                <Text style={mo.eduDegree}>{edu.degree}</Text>
                {edu.details && <Text style={mo.eduDetails}>{edu.details}</Text>}
              </View>
            ))}
          </>
        )}

        {/* Skills */}
        {data.skills.length > 0 && (
          <>
            <Text style={mo.sectionTitle}>Skills</Text>
            <View style={mo.skillsWrap}>
              {data.skills.map((s, i) => (
                <Text key={i} style={mo.skillPill}>{s}</Text>
              ))}
            </View>
          </>
        )}

        {/* Certifications */}
        {data.certifications && data.certifications.length > 0 && (
          <>
            <Text style={mo.sectionTitle}>Certifications</Text>
            <Text style={mo.certText}>{data.certifications.join('  ·  ')}</Text>
          </>
        )}
      </Page>
    </Document>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateResumePDF(data: ResumeData, templateId: TemplateId = 'minimal'): Promise<Buffer> {
  const doc = (() => {
    switch (templateId) {
      case 'sidebar': return <SidebarDoc data={data} />
      case 'modern':  return <ModernDoc data={data} />
      default:        return <MinimalDoc data={data} />
    }
  })()
  return renderToBuffer(doc) as Promise<Buffer>
}
