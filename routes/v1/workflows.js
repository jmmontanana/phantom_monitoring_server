var express = require('express');
var async = require('async');
var dateFormat = require('dateformat');
var router = express.Router();

/**
 * @api {get} /workflows 3. Request a list of registered workflows
 * @apiVersion 1.0.0
 * @apiName GetWorkflows
 * @apiGroup Workflows
 *
 * @apiSuccess {Object} :workflowID       References a registered workflow by its ID
 * @apiSuccess {String} :workflowID.href  Resource location of the given workflow
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "hpcdhopp": {
 *         "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/hpcdhopp"
 *       },
 *       "hpcdkhab": {
 *         "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/hpcdkhab"
 *       },
 *       "hpcfapix": {
 *         "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/hpcfapix"
 *       }
 *     }
 *
 * @apiError WorkflowsNotAvailable No workflows found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "No workflows found."
 *     }
 */
router.get('/', function(req, res, next) {
    var client = req.app.get('elastic'),
        size = 1000,
        json = {};

    client.search({
        index: 'mf',
        type: 'workflows',
        searchType: 'count'
    }, function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }
        if (response.hits !== undefined) {
            size = response.hits.total;
        }
        if (size === 0) {
            res.status(404);
            json.error = "No workflows found.";
            res.json(json);
            return;
        }

        client.search({
            index: 'mf',
            type: 'workflows',
            size: size
        }, function(error, response) {
            if (error) {
                res.status(500);
                return next(error);
            }
            if (response.hits !== undefined) {
                var results = response.hits.hits;
                json = get_details(results);
            }
            res.json(json);
        });
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

function get_details(results) {
    var keys = Object.keys(results),
        response = {};
    keys.forEach(function(key) {
        var source = results[key]._source,
            item = JSON.parse(JSON.stringify(source));
        if (is_defined(source.tasks)) {
            item.tasks = [];
            for (var i in source.tasks) {
                item.tasks.push(source.tasks[i].name);
            }
        }
        response[results[key]._id] = item;
    });
    return response;
}

/**
 * @api {get} /workflows/:workflowID 2. Get information about a specific workflow
 * @apiVersion 1.0.0
 * @apiName GetWorkflow
 * @apiGroup Workflows
 *
 * @apiParam {String} workflowID Unique workflow identifier
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2
 *
 * @apiSuccess (body) {String} wf_id   References a registered workflow by its ID
 * @apiSuccess (body) {String} author  Author name if provided while registering a new workflow
 * @apiSuccess (body) {String} optimization    Optimization criterium: time, energy, balanced
 * @apiSuccess (body) {Array}  tasks   List of individual tasks the workflow is composed of
 * @apiSuccess (body) {String} tasks.name  ID of the given task (:taskID)
 * @apiSuccess (body) {String} tasks.exec  Executable for the given task
 * @apiSuccess (body) {String} tasks.cores_nr  Range of CPU cores used for executing the task on
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "wf_id": "ms2",
 *       "author": "Random Guy",
 *       "optimization": "Time",
 *       "tasks": [
 *         {
 *           "name": "T1",
 *           "exec": "/home/ubuntu/ms2/t1.sh",
 *           "cores_nr": "1-2"
 *         },
 *         {
 *           "name": "T2.1",
 *           "exec": "/home/ubuntu/ms2/t21.sh",
 *           "previous": "T1",
 *           "cores_nr": "1-2"
 *          }
 *       ]
 *     }
 *
 * @apiError WorkflowNotAvailable Given ID does not refer to a workflow.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Workflow with the ID ':workflowID' not found."
 *     }
 */
router.get('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
        client = req.app.get('elastic'),
        json = {};

    client.get({
        index: 'mf',
        type: 'workflows',
        id: id
    }, function(error, response) {
        if (response.found) {
            json = response._source;
        } else {
            json.error = "Workflow with the ID '" + id + "' not found.";
        }
        res.json(json);
    });
});

/**
 * @api {put} /workflows/:workflowID 1. Register a new workflow with a custom ID
 * @apiVersion 1.0.0
 * @apiName PutWorkflowID
 * @apiGroup Workflows
 *
 * @apiParam {String} workflowID Unique workflow identifier
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "wf_id": "ms2",
 *       "author": "Random Guy",
 *       "optimization": "Time",
 *       "tasks": [
 *         {
 *           "name": "T1",
 *           "exec": "/home/ubuntu/ms2/t1.sh",
 *           "cores_nr": "1-2"
 *         },
 *         {
 *           "name": "T2.1",
 *           "exec": "/home/ubuntu/ms2/t21.sh",
 *           "previous": "T1",
 *           "cores_nr": "1-2"
 *          }
 *       ]
 *     }
 *
 * @apiParam {String} [wf_id]   References a registered workflow by its ID
 * @apiParam {String} [author]  Author name if provided while registering a new workflow
 * @apiParam {String} [optimization]    Optimization criterium: time, energy, balanced
 * @apiParam {Array}  [tasks]   List of individual tasks the workflow is composed of
 * @apiParam {String} [tasks.name]  ID of the given task (:taskID)
 * @apiParam {String} [tasks.exec]  Executable for the given task
 * @apiParam {String} [tasks.cores_nr]  Range of CPU cores used for executing the task on
 *
 * @apiSuccess {String} href Link to the stored workflow resource
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2",
 *     }
 *
 * @apiError StorageError Given workflow could not be stored.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "Resource could not be stored"
 *     }
 */
router.put('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
        mf_server = req.app.get('mf_server'),
        client = req.app.get('elastic'),
        json = {};

    client.index({
        index: 'mf',
        type: 'workflows',
        id: id,
        body: req.body
    }, function(error, response) {
        if (error !== 'undefined') {
            json.href = mf_server + '/mf/workflows/' + id;
        } else {
            res.status(500);
            json.error = "Could not create the workflow.";
        }
        res.json(json);
    });
});

module.exports = router;