# pf-analysis

Node-RED nodes for Planet Farms lab analysis report ingestion automation.

## Elasticsearch configuration

Two indices are used:

* `lab-reports`
* `lab-reports-flat`

The `lab-reports` index must be configured with the following mapping:

~~~http
PUT /lab-reports/_mapping
{
  "properties": {
    "timestamp": {
      "type": "date"
    },
    "entity": {
      "properties": {
        "report_date": {
          "type": "date"
        },
        "reception_date": {
          "type": "date"
        },
        "parameters": {
          "properties": {
            "value": {
              "type": "text"
            }
          }
        }
      }
    }
  }
}
~~~

The `lab-reports-flat` index must be configured with the following mapping:

~~~http
PUT /lab-reports-flat/_mapping
{
  "properties": {
    "timestamp": {
      "type": "date"
    },
    "reception_date": {
      "type": "date"
    },
    "value": {
      "type": "text"
    }
  }
}
~~~

## Search for unknown parameters

~~~json
{
  "query": {
    "bool": {
      "must": {
        "exists": {
          "field": "entity.unknownParameters"
        }
      }
    }
  }
}
~~~