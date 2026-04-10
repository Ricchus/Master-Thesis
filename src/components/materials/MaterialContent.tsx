import { Fragment, memo } from 'react'
import type { MaterialBlock, MaterialInline } from '../../lib/types'

function renderInlineContent(content: MaterialInline[]) {
  return content.map((inline, index) => {
    if (inline.type === 'strong') {
      return <strong key={`${inline.text}-${index}`}>{inline.text}</strong>
    }

    return <Fragment key={`${inline.text}-${index}`}>{inline.text}</Fragment>
  })
}

export const MaterialContent = memo(function MaterialContent({ content }: { content: MaterialBlock[] }) {
  return (
    <div className="materialRichContent">
      {content.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p className="materialParagraph" key={`paragraph-${index}`}>
              {renderInlineContent(block.content)}
            </p>
          )
        }

        if (block.type === 'bullets') {
          return (
            <ul className="materialBullets" key={`bullets-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`bullet-${index}-${itemIndex}`}>{renderInlineContent(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'table') {
          return (
            <div className="materialTableWrap" key={`table-${index}`}>
              <table className="materialTable">
                <thead>
                  <tr>
                    {block.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`row-${index}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${index}-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return (
          <div className="materialNote" key={`note-${index}`}>
            {block.title ? <div className="materialNoteTitle">{block.title}</div> : null}
            <p className="materialParagraph">{renderInlineContent(block.content)}</p>
          </div>
        )
      })}
    </div>
  )
})
