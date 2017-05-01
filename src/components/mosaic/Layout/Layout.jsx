/**
 * Layout container.
 * @module containers/Layout
 */

/* eslint react/prefer-stateless-function: 0 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { convertFromHTML, EditorState, ContentState } from 'draft-js';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import { isEqual, map, reduce, remove } from 'lodash';
import move from 'lodash-move';

import { Grid } from '../../../components';

/**
 * Layout component class.
 * @class Layout
 * @extends Component
 */
@DragDropContext(HTML5Backend)
export default class Layout extends Component {
  /**
   * Property types.
   * @property {Object} propTypes Property types.
   * @static
   */
  static propTypes = {
    layout: PropTypes.shape({
      rows: PropTypes.arrayOf(
        PropTypes.shape({
          columns: PropTypes.arrayOf(
            PropTypes.shape({
              width: PropTypes.number,
              tiles: PropTypes.arrayOf(
                PropTypes.shape({
                  content: PropTypes.string,
                  url: PropTypes.string,
                  type: PropTypes.string,
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  };

  /**
   * Default properties
   * @property {Object} defaultProps Default properties.
   * @static
   */
  static defaultProps = {
    layout: {
      rows: [
        {
          columns: [
            {
              width: 6,
              tiles: [
                {
                  content: '<p>Column <b>one</b></p>',
                  url: './@@plone.app.standardtiles.html/1',
                  type: 'Title',
                },
                {
                  content: 'Document by line',
                  url: './@@plone.app.standardtiles.html/2',
                  type: 'Document by line',
                },
              ],
            },
            {
              width: 10,
              tiles: [
                {
                  content: '<p>Column <b>two</b></p>',
                  url: './@@plone.app.standardtiles.html/3',
                  type: 'Description',
                },
              ],
            },
          ],
        },
        {
          columns: [
            {
              width: 16,
              tiles: [
                {
                  content: '<p>Column <b>full</b></p>',
                  url: './@@plone.app.standardtiles.html/4',
                  type: 'Text',
                },
                {
                  content: '<p>Column <b>full 2</b></p>',
                  url: './@@plone.app.standardtiles.html/5',
                  type: 'Text',
                },
              ],
            },
          ],
        },
      ],
    },
  };

  /**
   * Construcor
   * @param {Object} props Properties.
   * @constructs
   */
  constructor(props) {
    super(props);
    this.state = {
      layout: {
        rows: map(this.props.layout.rows, (row, rowIndex) => ({
          hovered: null,
          columns: map(row.columns, (column, columnIndex) => ({
            width: column.width,
            hovered: null,
            tiles: map(column.tiles, (tile, tileIndex) => ({
              url: tile.url,
              type: tile.type,
              content: __SERVER__
                ? tile.content
                : EditorState.createWithContent(
                    ContentState.createFromBlockArray(
                      convertFromHTML(tile.content),
                    ),
                  ),
              selected: rowIndex === 0 && columnIndex === 0 && tileIndex === 0,
              hovered: null,
            })),
          })),
        })),
      },
      selected: {
        row: 0,
        column: 0,
        tile: 0,
      },
      hovered: {
        row: -1,
        column: -1,
        tile: -1,
        type: '',
        direction: '',
      },
    };
    this.selectTile = this.selectTile.bind(this);
    this.deleteTile = this.deleteTile.bind(this);
    this.setHovered = this.setHovered.bind(this);
    this.setTileContent = this.setTileContent.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
  }

  /**
   * Set tile content.
   * @function setTileContent
   * @param {number} row Row index.
   * @param {number} column Column index.
   * @param {number} tile Tile index.
   * @param {Object} content New content.
   * @returns {undefined}
   */
  setTileContent(row, column, tile, content) {
    this.state.layout.rows[row].columns[column].tiles[tile].content = content;

    this.setState({
      layout: this.state.layout,
    });
  }

  /**
   * Set hovered.
   * @function setHovered
   * @param {number} row Row index.
   * @param {number} column Column index.
   * @param {number} tile Column index.
   * @param {string} type Selected type (row/column/tile).
   * @param {string} direction Direction.
   * @returns {undefined}
   */
  setHovered(row, column, tile, type, direction) {
    if (isEqual(this.state.hovered, { row, column, tile, type, direction })) {
      return;
    }

    // Deselect
    if (this.state.hovered.row !== -1) {
      switch (this.state.hovered.type) {
        case 'tile':
          this.state.layout.rows[this.state.hovered.row].columns[
            this.state.hovered.column
          ].tiles[this.state.hovered.tile].hovered = null;
          break;
        case 'column':
          this.state.layout.rows[this.state.hovered.row].columns[
            this.state.hovered.column
          ].hovered = null;
          break;
        default:
          this.state.layout.rows[this.state.hovered.row].hovered = null;
          break;
      }
    }

    // Select new
    if (row !== -1) {
      switch (type) {
        case 'tile':
          this.state.layout.rows[row].columns[column].tiles[
            tile
          ].hovered = direction;
          break;
        case 'column':
          this.state.layout.rows[row].columns[column].hovered = direction;
          break;
        default:
          this.state.layout.rows[row].hovered = direction;
          break;
      }
    }

    this.setState({
      hovered: {
        row,
        column,
        tile,
        type,
        direction,
      },
      layout: this.state.layout,
    });
  }

  /**
   * Handle drop.
   * @function handleDrop
   * @param {number} row Row index.
   * @param {number} column Column index.
   * @param {number} tile Tile index.
   * @returns {undefined}
   */
  handleDrop(row, column, tile) {
    const hovered = {
      ...this.state.hovered,
    };
    const offset = hovered.direction === 'bottom' ||
      hovered.direction === 'right'
      ? 1
      : 0;
    let removed;

    // Reset hovered
    this.setHovered(-1, -1, -1, '', '');

    switch (hovered.type) {
      case 'tile':
        // If source and target tile in the same column
        if (hovered.row === row && hovered.column === column) {
          // Move tile in column
          this.state.layout.rows[hovered.row].columns[
            hovered.column
          ].tiles = move(
            this.state.layout.rows[row].columns[column].tiles,
            tile,
            hovered.tile + offset,
          );
        } else {
          // Insert tile in new column
          this.state.layout.rows[hovered.row].columns[
            hovered.column
          ].tiles.splice(
            hovered.tile + offset,
            0,
            this.state.layout.rows[row].columns[column].tiles[tile],
          );
          // Remove tile in old column
          this.state.layout.rows[row].columns[column].tiles.splice(tile, 1);
        }
        break;
      case 'column':
        if (
          this.state.layout.rows[hovered.row].columns.length < 4 ||
          (hovered.row === row &&
            this.state.layout.rows[row].columns[column].tiles.length === 1)
        ) {
          // Remove tile from old position
          removed = this.state.layout.rows[row].columns[column].tiles.splice(
            tile,
            1,
          );
          // Add tile in new column
          this.state.layout.rows[hovered.row].columns.splice(
            hovered.column + offset,
            0,
            {
              width: this.state.layout.rows[row].columns[column].width,
              hovered: null,
              tiles: removed,
            },
          );
        }
        break;
      default:
        // Remove tile from old position
        removed = this.state.layout.rows[row].columns[column].tiles.splice(
          tile,
          1,
        );
        // Add tile in new column
        this.state.layout.rows.splice(hovered.row + offset, 0, {
          hovered: null,
          columns: [
            {
              width: 16,
              hovered: null,
              tiles: removed,
            },
          ],
        });
        break;
    }

    // Clean up layout
    this.cleanupLayout();

    // Set new state
    this.setState({
      layout: this.state.layout,
    });
  }

  /**
   * Cleanup layout.
   * @function cleanupLayout
   * @returns {undefined}
   */
  cleanupLayout() {
    // Clean up empty columns
    for (let row = 0; row < this.state.layout.rows.length; row += 1) {
      remove(
        this.state.layout.rows[row].columns,
        column => column.tiles.length === 0,
      );
    }

    // Clean up empty rows
    remove(this.state.layout.rows, row => row.columns.length === 0);

    // Resize columns
    for (let row = 0; row < this.state.layout.rows.length; row += 1) {
      if (
        reduce(
          map(this.state.layout.rows[row].columns, column => column.width),
          (x, y) => x + y,
        ) !== 16
      ) {
        switch (this.state.layout.rows[row].columns.length) {
          case 1:
            this.state.layout.rows[row].columns[0].width = 16;
            break;
          case 2:
            this.state.layout.rows[row].columns[0].width = 8;
            this.state.layout.rows[row].columns[1].width = 8;
            break;
          case 3:
            this.state.layout.rows[row].columns[0].width = 5;
            this.state.layout.rows[row].columns[1].width = 6;
            this.state.layout.rows[row].columns[2].width = 5;
            break;
          default:
            this.state.layout.rows[row].columns[0].width = 4;
            this.state.layout.rows[row].columns[1].width = 4;
            this.state.layout.rows[row].columns[2].width = 4;
            this.state.layout.rows[row].columns[3].width = 4;
            break;
        }
      }
    }

    // Set new state
    this.setState({
      layout: this.state.layout,
    });
  }

  /**
   * Select tile.
   * @function selectTile
   * @param {number} row Row index.
   * @param {number} column Column index.
   * @param {number} tile Tile index.
   * @returns {undefined}
   */
  selectTile(row, column, tile) {
    if (this.state.selected.row !== -1) {
      this.state.layout.rows[this.state.selected.row].columns[
        this.state.selected.column
      ].tiles[this.state.selected.tile].selected = false;
    }
    if (row !== -1) {
      this.state.layout.rows[row].columns[column].tiles[tile].selected = true;
    }
    this.setState({
      selected: {
        row,
        column,
        tile,
      },
      layout: this.state.layout,
    });
  }

  /**
   * Delete tile.
   * @function deleteTile
   * @param {number} row Row index.
   * @param {number} column Column index.
   * @param {number} tile Tile index.
   * @returns {undefined}
   */
  deleteTile(row, column, tile) {
    this.selectTile(-1, -1, -1);
    this.state.layout.rows[row].columns[column].tiles.splice(tile, 1);
    this.cleanupLayout();
  }

  /**
   * Render method.
   * @function render
   * @returns {string} Markup of the container.
   */
  render() {
    return (
      <Grid
        rows={this.state.layout.rows}
        selectTile={this.selectTile}
        deleteTile={this.deleteTile}
        setHovered={this.setHovered}
        handleDrop={this.handleDrop}
        setTileContent={this.setTileContent}
      />
    );
  }
}
