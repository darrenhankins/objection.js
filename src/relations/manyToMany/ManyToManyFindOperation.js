import _ from 'lodash';
import RelationFindOperation from '../RelationFindOperation';

const ownerJoinColumnAliasPrefix = 'objectiontmpjoin';

export default class ManyToManyFindOperation extends RelationFindOperation {

  constructor(name, opt) {
    super(name, opt);

    this.ownerJoinColumnAlias = new Array(this.relation.joinTableOwnerCol.length);

    for (let i = 0, l = this.relation.joinTableOwnerCol.length; i < l; ++i) {
      this.ownerJoinColumnAlias[i] = ownerJoinColumnAliasPrefix + i;
    }
  }

  onBeforeBuild(builder) {
    const relatedModelClass = this.relation.relatedModelClass;
    const ids = new Array(this.owners.length);

    for (let i = 0, l = this.owners.length; i < l; ++i) {
      ids[i] = this.owners[i].$values(this.relation.ownerProp);
    }

    if (!builder.has(builder.constructor.SelectSelector)) {
      // If the user hasn't specified a select clause, select the related model's columns.
      // If we don't do this we also get the join table's columns.
      builder.select(relatedModelClass.tableName + '.*');

      // Also select all extra columns.
      for (let i = 0, l = this.relation.joinTableExtras.length; i < l; ++i) {
        const extra = this.relation.joinTableExtras[i];
        const joinTable = this.relation.joinTable;

        builder.select(`${joinTable}.${extra.joinTableCol} as ${extra.aliasCol}`);
      }
    }

    this.relation.findQuery(builder, {
      ownerIds: _.uniqBy(ids, join)
    });

    const fullJoinTableOwnerCol = this.relation.fullJoinTableOwnerCol();
    // We must select the owner join columns so that we know for which owner model the related
    // models belong to after the requests.
    for (let i = 0, l = fullJoinTableOwnerCol.length; i < l; ++i) {
      builder.select(fullJoinTableOwnerCol[i] + ' as ' + this.ownerJoinColumnAlias[i]);

      // Mark them to be omitted later.
      this.omitProps.push(relatedModelClass.columnNameToPropertyName(this.ownerJoinColumnAlias[i]));
    }

    this.addJoinColumnSelects(builder);
  }

  onAfterInternal(builder, related) {
    const isOneToOne = this.relation.isOneToOne();
    const relatedByOwnerId = Object.create(null);

    for (let i = 0, l = related.length; i < l; ++i) {
      const rel = related[i];
      const key = rel.$propKey(this.ownerJoinColumnAlias);
      let arr = relatedByOwnerId[key];

      if (!arr) {
        arr = [];
        relatedByOwnerId[key] = arr;
      }

      arr.push(rel);
    }

    for (let i = 0, l = this.owners.length; i < l; ++i) {
      const own = this.owners[i];
      const key = own.$propKey(this.relation.ownerProp);
      const related = relatedByOwnerId[key];

      if (isOneToOne) {
        own[this.relation.name] = (related && related[0]) || null;
      } else {
        own[this.relation.name] = related || [];
      }
    }

    if (this.alwaysReturnArray) {
      return related;
    } else {
      return isOneToOne ? related[0] || undefined : related;
    }
  }
}

function join(arr) {
  return arr.join();
}